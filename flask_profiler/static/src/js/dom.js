// Minimal DOM helper for declarative element creation
export function createElement(tag, { className, attrs, text } = {}, ...children) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text != null) {
    node.textContent = text;
  }
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value != null) {
        node.setAttribute(key, String(value));
      }
    });
  }
  const appendChild = (child) => {
    if (child == null) {
      return;
    }
    if (Array.isArray(child)) {
      child.forEach(appendChild);
      return;
    }
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(child.toString()));
      return;
    }
    node.appendChild(child);
  };
  children.forEach(appendChild);
  return node;
}
