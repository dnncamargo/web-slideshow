import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { fileURLToPath } from "node:url";

const REQUIRED_ARGUMENTS = ["project-id", "owner-uid", "presentation-id", "publication-id"];

export const usage = `Usage:
  pnpm backfill:publication-owner --project-id <id> --owner-uid <uid> \
    --presentation-id <id> --publication-id <id> [--apply]

Default behavior is a dry run. No write occurs without --apply.

WARNING: Do not apply production backfills until the owner-bound publication
implementation and Firestore Rules from this feature have been deployed.
Older publishing code can overwrite a pointer without ownerUid.`;

export class BackfillError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BackfillError";
    this.code = code;
  }
}

export function parseArgs(argv) {
  const values = new Map();
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      if (argv.length !== 1) throw new BackfillError("invalid_arguments", "--help cannot be combined with other arguments");
      return { help: true };
    }
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (!argument?.startsWith("--")) throw new BackfillError("invalid_arguments", `Unknown argument: ${argument ?? "<empty>"}`);

    const name = argument.slice(2);
    if (!REQUIRED_ARGUMENTS.includes(name)) throw new BackfillError("invalid_arguments", `Unknown argument: ${argument}`);
    if (values.has(name)) throw new BackfillError("invalid_arguments", `Duplicate argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new BackfillError("invalid_arguments", `Missing value for ${argument}`);
    values.set(name, value);
    index += 1;
  }

  const missing = REQUIRED_ARGUMENTS.filter((name) => !values.has(name));
  if (missing.length > 0) throw new BackfillError("invalid_arguments", `Missing required arguments: ${missing.map((name) => `--${name}`).join(", ")}`);

  return {
    help: false,
    apply,
    projectId: values.get("project-id"),
    ownerUid: values.get("owner-uid"),
    presentationId: values.get("presentation-id"),
    publicationId: values.get("publication-id"),
  };
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new BackfillError("invalid_metadata", `${field} must be a non-empty string`);
}

function requireExactKeys(data, keys, label) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new BackfillError("invalid_metadata", `${label} must be a map`);
  const actual = Object.keys(data).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new BackfillError("invalid_metadata", `${label} has unexpected fields`);
  }
}

function requireFields(data, fields, label) {
  if (!data || typeof data !== "object" || Array.isArray(data) || fields.some((field) => !Object.prototype.hasOwnProperty.call(data, field))) {
    throw new BackfillError("invalid_metadata", `${label} is missing required fields`);
  }
}

function requireRevision(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new BackfillError("invalid_metadata", `${label} must be a non-negative integer`);
}

function requireTimestamp(value, label) {
  if (!(value instanceof Timestamp)) throw new BackfillError("invalid_metadata", `${label} must be a persisted timestamp`);
}

function sameTimestamp(left, right) {
  return left instanceof Timestamp && right instanceof Timestamp && left.isEqual(right);
}

function validatePublicationMetadata(publication) {
  requireExactKeys(publication, ["publicationId", "currentVersionId", "publishedRevision", "publishedAt"], "Draft publication metadata");
  requireNonEmptyString(publication.publicationId, "publication.publicationId");
  requireNonEmptyString(publication.currentVersionId, "publication.currentVersionId");
  requireRevision(publication.publishedRevision, "publication.publishedRevision");
  requireTimestamp(publication.publishedAt, "publication.publishedAt");
}

function validateDraft(snapshot, input) {
  if (!snapshot.exists) throw new BackfillError("missing_draft", `Draft not found for supplied owner UID and presentation ID`);
  const data = snapshot.data();
  if (data.archivedAt === undefined || data.archivedAt === null) throw new BackfillError("draft_not_archived", "Draft is not archived");
  if (!data.publication) throw new BackfillError("invalid_publication_metadata", "Draft has no publication metadata");
  validatePublicationMetadata(data.publication);
  if (data.publication.publicationId !== input.publicationId) throw new BackfillError("publication_id_mismatch", "Draft publicationId does not match supplied publication ID");
  return data.publication;
}

function validatePointer(snapshot, publication, input) {
  if (!snapshot.exists) throw new BackfillError("missing_pointer", "Published pointer not found");
  const data = snapshot.data();
  const ownerState = Object.prototype.hasOwnProperty.call(data, "ownerUid") ? data.ownerUid : undefined;
  if (ownerState === undefined) {
    requireExactKeys(data, ["currentVersionId", "publishedRevision", "publishedAt"], "Legacy published pointer");
  } else {
    requireExactKeys(data, ["ownerUid", "currentVersionId", "publishedRevision", "publishedAt"], "Published pointer");
    requireNonEmptyString(ownerState, "pointer.ownerUid");
    if (ownerState !== input.ownerUid) throw new BackfillError("pointer_owner_conflict", "Published pointer is already bound to another owner UID");
  }
  requireNonEmptyString(data.currentVersionId, "pointer.currentVersionId");
  requireRevision(data.publishedRevision, "pointer.publishedRevision");
  requireTimestamp(data.publishedAt, "pointer.publishedAt");
  if (data.currentVersionId !== publication.currentVersionId) throw new BackfillError("pointer_metadata_mismatch", "Pointer currentVersionId does not match draft publication metadata");
  if (data.publishedRevision !== publication.publishedRevision) throw new BackfillError("pointer_metadata_mismatch", "Pointer publishedRevision does not match draft publication metadata");
  if (!sameTimestamp(data.publishedAt, publication.publishedAt)) throw new BackfillError("pointer_metadata_mismatch", "Pointer publishedAt does not match draft publication metadata");
  return { ...data, ownerUid: ownerState };
}

function validateVersion(snapshot, publication, input) {
  if (!snapshot.exists) throw new BackfillError("missing_current_version", "Current published version not found");
  const data = snapshot.data();
  requireFields(data, ["presentationId", "presentationJson", "publishedRevision", "publishedAt"], "Current published version");
  if (data.presentationId !== input.presentationId) throw new BackfillError("current_version_presentation_mismatch", "Current published version does not belong to supplied presentation ID");
  if (typeof data.presentationJson !== "string" || data.presentationJson.length === 0) throw new BackfillError("invalid_current_version", "Current published version has no presentation JSON");
  requireRevision(data.publishedRevision, "version.publishedRevision");
  requireTimestamp(data.publishedAt, "version.publishedAt");
  if (data.publishedRevision !== publication.publishedRevision) throw new BackfillError("current_version_metadata_mismatch", "Current published version revision does not match publication metadata");
  if (!sameTimestamp(data.publishedAt, publication.publishedAt)) throw new BackfillError("current_version_metadata_mismatch", "Current published version timestamp does not match publication metadata");
}

async function readAndValidate(db, input) {
  const draftRef = db.doc(`users/${input.ownerUid}/presentations/${input.presentationId}`);
  const draftSnapshot = await draftRef.get();
  const publication = validateDraft(draftSnapshot, input);
  const pointerRef = db.doc(`publishedPresentations/${input.publicationId}`);
  const pointerSnapshot = await pointerRef.get();
  const pointer = validatePointer(pointerSnapshot, publication, input);
  const versionRef = pointerRef.collection("versions").doc(publication.currentVersionId);
  const versionSnapshot = await versionRef.get();
  validateVersion(versionSnapshot, publication, input);
  return { draftRef, pointerRef, versionRef, pointer };
}

export async function backfillPublicationOwner(db, input, apply = false) {
  const initial = await readAndValidate(db, input);
  if (!apply) return { status: initial.pointer.ownerUid === input.ownerUid ? "ALREADY_BOUND" : "DRY_RUN_READY" };

  return db.runTransaction(async (transaction) => {
    const draftSnapshot = await transaction.get(initial.draftRef);
    const publication = validateDraft(draftSnapshot, input);
    const pointerSnapshot = await transaction.get(initial.pointerRef);
    const pointer = validatePointer(pointerSnapshot, publication, input);
    const versionSnapshot = await transaction.get(initial.versionRef);
    validateVersion(versionSnapshot, publication, input);
    if (pointer.ownerUid === input.ownerUid) return { status: "ALREADY_BOUND" };
    transaction.update(initial.pointerRef, { ownerUid: input.ownerUid });
    return { status: "BACKFILLED" };
  });
}

export function getAdminFirestore(projectId) {
  const app = getApps().find((candidate) => candidate.options.projectId === projectId) ?? initializeApp({ projectId });
  return getFirestore(app);
}

async function main() {
  let input;
  try {
    input = parseArgs(process.argv.slice(2));
    if (input.help) {
      console.log(usage);
      return;
    }
    const result = await backfillPublicationOwner(getAdminFirestore(input.projectId), input, input.apply);
    console.log(result.status);
  } catch (error) {
    if (error instanceof BackfillError) console.error(`ERROR [${error.code}] ${error.message}`);
    else console.error(`ERROR [execution_failed] ${error instanceof Error ? error.message : "Unknown failure"}`);
    console.error(usage);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
