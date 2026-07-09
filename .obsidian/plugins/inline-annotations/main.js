var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => InlineAnnotationsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var ANNOTATION_REGEX = /\{([^}]*?)::([^}]+)\}/g;
var DEFAULT_SETTINGS = {
  triggerMode: "click"
};
var pluginSettings = DEFAULT_SETTINGS;
var pluginApp;
function processAnnotations(el, ctx) {
  var _a;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  for (const textNode of textNodes) {
    const text = textNode.textContent;
    if (!text)
      continue;
    ANNOTATION_REGEX.lastIndex = 0;
    const matches = [...text.matchAll(ANNOTATION_REGEX)];
    if (matches.length === 0)
      continue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    for (const match of matches) {
      const matchStart = (_a = match.index) != null ? _a : 0;
      const visibleText = match[1];
      const annotation = match[2];
      if (matchStart > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, matchStart))
        );
      }
      const span = document.createElement("span");
      span.className = "inline-annotation";
      span.textContent = visibleText;
      span.setAttribute("data-annotation", annotation);
      fragment.appendChild(span);
      lastIndex = matchStart + match[0].length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(
        document.createTextNode(text.slice(lastIndex))
      );
    }
    textNode.replaceWith(fragment);
  }
}
var activePopup = null;
var activeHoverTarget = null;
var hoverTimeout = null;
function removePopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
  activeHoverTarget = null;
}
function resolveAnnotation(anchor) {
  const cmEditor = anchor.closest(".cm-editor");
  if (!cmEditor)
    return null;
  const editorView = import_view.EditorView.findFromDOM(cmEditor);
  if (!editorView)
    return null;
  const pos = editorView.posAtDOM(anchor);
  const lineObj = editorView.state.doc.lineAt(pos);
  const found = findAnnotationAt(lineObj.text, lineObj.from, pos);
  if (!found)
    return null;
  return { found, editorView };
}
function showAnnotationPopup(annotation, x, y, anchor) {
  removePopup();
  const popup = document.createElement("div");
  popup.className = "annotation-popup";
  const textarea = document.createElement("textarea");
  textarea.className = "annotation-popup-textarea";
  textarea.value = annotation;
  textarea.readOnly = true;
  textarea.rows = Math.min(annotation.split("\n").length, 10);
  popup.appendChild(textarea);
  if (anchor) {
    const resolved = resolveAnnotation(anchor);
    if (resolved) {
      const { found, editorView } = resolved;
      const btnRow = document.createElement("div");
      btnRow.className = "annotation-popup-buttons";
      const editBtn = document.createElement("button");
      editBtn.className = "annotation-popup-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        removePopup();
        new AnnotationModal(
          pluginApp,
          (newAnnotation) => {
            if (newAnnotation) {
              editorView.dispatch({
                changes: {
                  from: found.from,
                  to: found.to,
                  insert: `{${found.visibleText}::${newAnnotation}}`
                }
              });
            }
          },
          found.annotation,
          "Edit annotation"
        ).open();
      });
      btnRow.appendChild(editBtn);
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "annotation-popup-btn annotation-popup-btn-danger";
      deleteBtn.textContent = "Remove";
      deleteBtn.addEventListener("click", () => {
        removePopup();
        editorView.dispatch({
          changes: { from: found.from, to: found.to, insert: found.visibleText }
        });
      });
      btnRow.appendChild(deleteBtn);
      popup.appendChild(btnRow);
    }
  }
  popup.addClass("is-hidden");
  document.body.appendChild(popup);
  requestAnimationFrame(() => {
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;
    const pad = 8;
    let lineRect = null;
    if (anchor) {
      const rects = anchor.getClientRects();
      let minDist = Infinity;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const dist = Math.abs((r.top + r.bottom) / 2 - y);
        if (dist < minDist) {
          minDist = dist;
          lineRect = r;
        }
      }
    }
    let top;
    let left;
    if (lineRect) {
      top = lineRect.top - popupHeight - 2;
      left = lineRect.left + lineRect.width / 2;
    } else {
      top = y - popupHeight - 2;
      left = x;
    }
    const halfW = popupWidth / 2;
    left = Math.max(halfW + pad, Math.min(left, window.innerWidth - halfW - pad));
    if (top < pad) {
      top = lineRect ? lineRect.bottom + 2 : y + 2;
    }
    popup.setCssProps({ "--popup-top": `${top}px`, "--popup-left": `${left}px` });
    popup.removeClass("is-hidden");
  });
  activePopup = popup;
  activeHoverTarget = anchor != null ? anchor : null;
  if (pluginSettings.triggerMode === "click") {
    const close = (e) => {
      if (!popup.contains(e.target)) {
        removePopup();
        document.removeEventListener("click", close, true);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", close, true);
    }, 10);
  }
  if (pluginSettings.triggerMode === "hover") {
    popup.addEventListener("mouseenter", () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
    });
    popup.addEventListener("mouseleave", () => {
      hoverTimeout = setTimeout(removePopup, 150);
    });
  }
}
var AnnotationWidget = class extends import_view.WidgetType {
  constructor(visibleText, annotation) {
    super();
    this.visibleText = visibleText;
    this.annotation = annotation;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "inline-annotation";
    span.textContent = this.visibleText;
    span.setAttribute("data-annotation", this.annotation);
    return span;
  }
  eq(other) {
    return this.visibleText === other.visibleText && this.annotation === other.annotation;
  }
  ignoreEvent() {
    return true;
  }
};
var AnnotationViewPlugin = class {
  constructor(view) {
    this.decorations = this.buildDecorations(view);
  }
  update(update) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }
  buildDecorations(view) {
    const builder = new import_state.RangeSetBuilder();
    const doc = view.state.doc;
    for (const { from, to } of view.visibleRanges) {
      const text = doc.sliceString(from, to);
      ANNOTATION_REGEX.lastIndex = 0;
      let match;
      while ((match = ANNOTATION_REGEX.exec(text)) !== null) {
        const start = from + match.index;
        const end = start + match[0].length;
        const cursorInside = view.state.selection.ranges.some(
          (r) => r.from >= start && r.to <= end
        );
        if (!cursorInside) {
          builder.add(
            start,
            end,
            import_view.Decoration.replace({
              widget: new AnnotationWidget(match[1], match[2])
            })
          );
        }
      }
    }
    return builder.finish();
  }
  destroy() {
  }
};
var annotationViewPlugin = import_view.ViewPlugin.fromClass(AnnotationViewPlugin, {
  decorations: (v) => v.decorations
});
var AnnotationModal = class extends import_obsidian.Modal {
  constructor(app, onSubmit, initialValue = "", title = "Add annotation") {
    super(app);
    this.onSubmit = onSubmit;
    this.initialValue = initialValue;
    this.title = title;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });
    const textarea = contentEl.createEl("textarea", {
      cls: "annotation-modal-textarea",
      placeholder: "e.g. DC15 - you struggle"
    });
    textarea.value = this.initialValue;
    textarea.rows = 5;
    const submit = () => {
      const value = textarea.value;
      this.close();
      setTimeout(() => this.onSubmit(value), 50);
    };
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }
    });
    const buttonRow = contentEl.createDiv({ cls: "annotation-modal-buttons" });
    buttonRow.createEl("button", { text: "Save", cls: "mod-cta" }).addEventListener("click", submit);
    buttonRow.createEl("small", {
      text: "or press Ctrl+Enter",
      cls: "annotation-modal-hint"
    });
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 50);
  }
  onClose() {
    this.contentEl.empty();
  }
};
function findAnnotationAt(lineText, lineFrom, pos) {
  ANNOTATION_REGEX.lastIndex = 0;
  let match;
  while ((match = ANNOTATION_REGEX.exec(lineText)) !== null) {
    const from = lineFrom + match.index;
    const to = from + match[0].length;
    if (pos >= from && pos <= to) {
      return { visibleText: match[1], annotation: match[2], from, to };
    }
  }
  return null;
}
var InlineAnnotationSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Trigger mode").setDesc("How to reveal annotation popups").addDropdown(
      (dropdown) => dropdown.addOption("click", "Click").addOption("hover", "Hover").setValue(this.plugin.settings.triggerMode).onChange(async (value) => {
        this.plugin.settings.triggerMode = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
function getAnnotationTarget(e) {
  const el = e.target;
  if (!(el instanceof HTMLElement))
    return null;
  return el.closest(".inline-annotation");
}
var InlineAnnotationsPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerMarkdownPostProcessor(processAnnotations);
    this.registerEditorExtension(annotationViewPlugin);
    this.addSettingTab(new InlineAnnotationSettingTab(this.app, this));
    const onClick = (e) => {
      if (pluginSettings.triggerMode !== "click")
        return;
      const target = getAnnotationTarget(e);
      if (!target)
        return;
      const annotation = target.getAttribute("data-annotation");
      if (!annotation)
        return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showAnnotationPopup(annotation, e.clientX, e.clientY, target);
    };
    document.addEventListener("click", onClick, true);
    this.register(
      () => document.removeEventListener("click", onClick, true)
    );
    const onMouseOver = (e) => {
      if (pluginSettings.triggerMode !== "hover")
        return;
      const target = getAnnotationTarget(e);
      if (!target || target === activeHoverTarget)
        return;
      const annotation = target.getAttribute("data-annotation");
      if (!annotation)
        return;
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      const rect = target.getBoundingClientRect();
      showAnnotationPopup(
        annotation,
        rect.left + rect.width / 2,
        rect.bottom,
        target
      );
    };
    const onMouseOut = (e) => {
      if (pluginSettings.triggerMode !== "hover")
        return;
      const target = getAnnotationTarget(e);
      if (!target)
        return;
      hoverTimeout = setTimeout(removePopup, 150);
    };
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    this.register(() => {
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("mouseout", onMouseOut, true);
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", removePopup)
    );
    this.register(removePopup);
    const onContextMenu = (e) => {
      const target = getAnnotationTarget(e);
      if (!target)
        return;
      const cmEditor = target.closest(".cm-editor");
      if (!cmEditor)
        return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const editorView = import_view.EditorView.findFromDOM(cmEditor);
      if (!editorView)
        return;
      const pos = editorView.posAtDOM(target);
      const lineObj = editorView.state.doc.lineAt(pos);
      const found = findAnnotationAt(lineObj.text, lineObj.from, pos);
      if (!found)
        return;
      const menu = new import_obsidian.Menu();
      menu.addItem((item) => {
        item.setTitle("Edit annotation").setIcon("pencil").onClick(() => {
          new AnnotationModal(
            this.app,
            (newAnnotation) => {
              if (newAnnotation) {
                editorView.dispatch({
                  changes: {
                    from: found.from,
                    to: found.to,
                    insert: `{${found.visibleText}::${newAnnotation}}`
                  }
                });
              }
            },
            found.annotation,
            "Edit annotation"
          ).open();
        });
      });
      menu.addItem((item) => {
        item.setTitle("Remove annotation").setIcon("x-circle").onClick(() => {
          editorView.dispatch({
            changes: {
              from: found.from,
              to: found.to,
              insert: found.visibleText
            }
          });
        });
      });
      menu.showAtMouseEvent(e);
    };
    document.addEventListener("contextmenu", onContextMenu, true);
    this.register(
      () => document.removeEventListener("contextmenu", onContextMenu, true)
    );
    this.addCommand({
      id: "annotate-selection",
      name: "Annotate selection",
      editorCallback: (editor, view) => {
        const selection = editor.getSelection();
        if (!selection)
          return;
        new AnnotationModal(this.app, (annotation) => {
          if (annotation) {
            editor.replaceSelection(
              `{${selection}::${annotation}}`
            );
          }
        }).open();
      }
    });
    this.addCommand({
      id: "remove-annotation",
      name: "Remove annotation from selection",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const found = findAnnotationAt(line, 0, cursor.ch);
        if (!found)
          return;
        editor.replaceRange(
          found.visibleText,
          { line: cursor.line, ch: found.from },
          { line: cursor.line, ch: found.to }
        );
      }
    });
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu, editor, view) => {
          const selection = editor.getSelection();
          if (selection) {
            menu.addItem((item) => {
              item.setTitle("Annotate selection").setIcon("message-square").onClick(() => {
                new AnnotationModal(
                  this.app,
                  (annotation) => {
                    if (annotation) {
                      editor.replaceSelection(
                        `{${selection}::${annotation}}`
                      );
                    }
                  }
                ).open();
              });
            });
          }
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          const found = findAnnotationAt(line, 0, cursor.ch);
          if (!found)
            return;
          menu.addItem((item) => {
            item.setTitle("Edit annotation").setIcon("pencil").onClick(() => {
              new AnnotationModal(
                this.app,
                (newAnnotation) => {
                  if (newAnnotation) {
                    editor.replaceRange(
                      `{${found.visibleText}::${newAnnotation}}`,
                      { line: cursor.line, ch: found.from },
                      { line: cursor.line, ch: found.to }
                    );
                  }
                },
                found.annotation,
                "Edit annotation"
              ).open();
            });
          });
          menu.addItem((item) => {
            item.setTitle("Remove annotation").setIcon("x-circle").onClick(() => {
              editor.replaceRange(
                found.visibleText,
                { line: cursor.line, ch: found.from },
                { line: cursor.line, ch: found.to }
              );
            });
          });
        }
      )
    );
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
    pluginSettings = this.settings;
    pluginApp = this.app;
  }
  async saveSettings() {
    await this.saveData(this.settings);
    pluginSettings = this.settings;
  }
};
