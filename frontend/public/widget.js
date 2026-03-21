(function () {
  var PARTNER_ID = document.currentScript
    ? (document.currentScript.getAttribute("data-partner-id") || "unknown")
    : "unknown";
  var BASE_URL = "https://attorney-matchmaker.onrender.com";

  var btn = document.createElement("button");
  btn.textContent = "Get Free Legal Help";
  btn.style.cssText = [
    "background:#FCAA2D",
    "color:#191918",
    "border:none",
    "border-radius:6px",
    "padding:14px 28px",
    "font-family:monospace",
    "font-size:0.75rem",
    "letter-spacing:0.1em",
    "text-transform:uppercase",
    "font-weight:600",
    "cursor:pointer",
    "display:inline-block",
  ].join(";");

  var overlay = document.createElement("div");
  overlay.style.cssText = [
    "display:none",
    "position:fixed",
    "top:0", "left:0", "right:0", "bottom:0",
    "background:rgba(0,0,0,0.5)",
    "z-index:99999",
    "align-items:center",
    "justify-content:center",
  ].join(";");

  var modal = document.createElement("div");
  modal.style.cssText = [
    "background:white",
    "border-radius:10px",
    "width:90vw",
    "max-width:560px",
    "max-height:90vh",
    "overflow:hidden",
    "position:relative",
  ].join(";");

  var closeBtn = document.createElement("button");
  closeBtn.textContent = "x";
  closeBtn.style.cssText = [
    "position:absolute",
    "top:12px", "right:16px",
    "background:none", "border:none",
    "font-size:1.5rem",
    "cursor:pointer",
    "color:#191918",
    "z-index:1",
  ].join(";");

  var iframe = document.createElement("iframe");
  iframe.style.cssText = "width:100%;height:80vh;border:none;display:block;";
  iframe.src = BASE_URL + "/widget/intake?partner_id=" + PARTNER_ID;

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  btn.addEventListener("click", function () {
    overlay.style.display = "flex";
  });

  closeBtn.addEventListener("click", function () {
    overlay.style.display = "none";
  });

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.style.display = "none";
  });

  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "INTAKE_COMPLETE") {
      overlay.style.display = "none";
    }
  });

  var script = document.currentScript;
  if (script && script.parentNode) {
    script.parentNode.insertBefore(btn, script.nextSibling);
  } else {
    document.body.appendChild(btn);
  }
})();
