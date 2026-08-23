import type { ContainerElement, ElementLink, PowerShowElement } from "@powershow/document-schema";
import { quoteCssString } from "./escape-css-string";
import { escapeHtml } from "./escape-html";
import { renderBackgroundPattern } from "./render-background-pattern";
import { isAbsolutePlacement } from "./render-placement";
import { renderLength } from "./render-length";
import { renderBorder, renderGradient, renderShadow } from "./render-visual";

type Alignment = "start" | "center" | "end" | "stretch";
type RenderChild = (element: PowerShowElement) => string;
const LINK_Z = 100;
const add = (o: string[], p: string, v: string | number | undefined) => { if (v !== undefined) o.push(`${p}:${v}`); };
const addLen = (o: string[], p: string, v: Parameters<typeof renderLength>[0] | undefined) => { if (v !== undefined) o.push(`${p}:${renderLength(v)}`); };
function layoutStyles(e: ContainerElement): string[] {
  const l = e.layout; if (!l) return []; const o: string[] = [];
  for (const [p, v] of [["width",l.width],["height",l.height],["min-width",l.minWidth],["min-height",l.minHeight],["max-width",l.maxWidth],["max-height",l.maxHeight],["margin",l.margin],["margin-top",l.marginTop],["margin-right",l.marginRight],["margin-bottom",l.marginBottom],["margin-left",l.marginLeft],["padding",l.padding],["padding-top",l.paddingTop],["padding-right",l.paddingRight],["padding-bottom",l.paddingBottom],["padding-left",l.paddingLeft]] as const) addLen(o,p,v);
  add(o,"overflow",l.overflow); add(o,"position",l.position);
  for (const [p,v] of [["top",l.top],["right",l.right],["bottom",l.bottom],["left",l.left]] as const) addLen(o,p,v);
  return o;
}
function visualStyles(e: ContainerElement): string[] { const s=e.style; if(!s)return[]; const o:string[]=[]; add(o,"color",s.color); if(s.background?.color)add(o,"background",s.background.color); if(s.background?.gradient)o.push(`background-image:${renderGradient(s.background.gradient)}`); addLen(o,"border-radius",s.borderRadius); if(s.border)o.push(...renderBorder(s.border)); return o; }
function typographyStyles(e: ContainerElement): string[] { const t=e.typography; if(!t)return[]; const o:string[]=[]; if(t.fontFamily!==undefined)o.push(`font-family:${quoteCssString(t.fontFamily)}`); addLen(o,"font-size",t.fontSize); add(o,"font-weight",t.fontWeight); add(o,"font-style",t.fontStyle); add(o,"text-align",t.textAlign); add(o,"line-height",t.lineHeight); addLen(o,"letter-spacing",t.letterSpacing); add(o,"text-transform",t.textTransform); add(o,"white-space",t.whiteSpace); add(o,"text-wrap-style",t.textWrapStyle); add(o,"overflow-wrap",t.overflowWrap); add(o,"text-decoration-line",t.textDecorationLine); add(o,"text-decoration-color",t.textDecorationColor); if(t.textStroke)o.push(`-webkit-text-stroke:${renderLength(t.textStroke.width)} ${t.textStroke.color}`); return o; }
function effectStyles(e: ContainerElement): string[] { const x=e.effect; if(!x)return[]; const o:string[]=[]; add(o,"opacity",x.opacity); if(x.shadow)o.push(`box-shadow:${renderShadow(x.shadow)}`); return o; }
function mainAlign(v: Alignment): string { return v === "start" || v === "stretch" ? "flex-start" : v === "end" ? "flex-end" : "center"; }
function crossAlign(v: Alignment): string { return v === "start" ? "flex-start" : v === "end" ? "flex-end" : v; }
function tag(role: ContainerElement["role"]): "div"|"main"|"header"|"footer" { return role === "main" || role === "header" || role === "footer" ? role : "div"; }
function stackChild(s:string):string { if(!s)return""; return s.includes(" style=") ? s.replace(" style=\""," style=\"grid-area:1 / 1;") : s.replace(/^(<[\s\S]*?)(?=\s|>)/,"$1 style=\"grid-area:1 / 1\""); }
function hasAbsoluteChild(e:ContainerElement):boolean { return e.children.some(c => c.type === "container" ? c.layout?.position === "absolute" : c.style?.position === "absolute" || isAbsolutePlacement(c.style?.placement)); }
function linkSurface(l:ElementLink):string { const a=[`href="${escapeHtml(l.href)}"`,'data-powershow-link="true"','data-powershow-container-link-surface="true"',`style="position:absolute;inset:0;z-index:${LINK_Z}"`]; if(l.target==="_blank")a.push('target="_blank"','rel="noopener noreferrer"'); else if(l.target==="_self")a.push('target="_self"'); return `<a ${a.join(" ")}></a>`; }
export function renderContainer(e:ContainerElement, renderChild:RenderChild):string {
  if(e.hidden)return""; const s=[...layoutStyles(e),...visualStyles(e),...typographyStyles(e),...effectStyles(e)]; const c=e.layout?.children; const mode=c?.mode??"flow", direction=c?.direction??"column", distribution=c?.distribution??"packed", ha=c?.horizontalAlign, va=c?.verticalAlign, stack=mode==="stack", linked=e.link!==undefined, patterned=e.style?.background?.pattern!==undefined;
  s.push(stack?"display:grid":"display:flex"); if((hasAbsoluteChild(e)||linked||patterned)&&e.layout?.position!=="absolute")s.push("position:relative"); if(patterned)s.push("isolation:isolate"); if(linked)s.push("z-index:0");
  if(stack){if(ha)s.push(`justify-items:${ha}`);if(va)s.push(`align-items:${va}`);}else{ s.push(`flex-direction:${direction}`); if(c?.gap!==undefined)s.push(`gap:${renderLength(c.gap)}`); if(distribution!=="packed")s.push(`justify-content:${distribution}`); else if(direction==="row"&&ha)s.push(`justify-content:${mainAlign(ha)}`); else if(direction==="column"&&va)s.push(`justify-content:${mainAlign(va)}`); if(direction==="row"&&va)s.push(`align-items:${crossAlign(va)}`); if(direction==="column"&&ha)s.push(`align-items:${crossAlign(ha)}`); }
  const classes=["powershow-element","powershow-container"]; if(stack)classes.push("powershow-container-stack"); if(e.role)classes.push(`powershow-container-${e.role}`); if(e.style?.className?.trim())classes.push(e.style.className.trim()); const p=e.style?.background?.pattern; const pattern=p?`<div class="powershow-container-background-pattern" aria-hidden="true" style="${escapeHtml("position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;"+renderBackgroundPattern(p))}"></div>`:""; const children=e.children.map(x=>{const r=renderChild(x);return stack?stackChild(r):r;}).join(""); const role=e.role?` data-powershow-role="${escapeHtml(e.role)}"`:""; const t=tag(e.role); return `<${t} class="${escapeHtml(classes.join(" "))}" data-powershow-id="${escapeHtml(e.id)}" data-powershow-type="container"${role} style="${escapeHtml(s.join(";"))}">${pattern}${children}${e.link?linkSurface(e.link):""}</${t}>`;
}
