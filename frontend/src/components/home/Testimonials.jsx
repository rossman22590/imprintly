import { useEffect } from "react";

function Testimonials() {
  useEffect(() => {
    const existing = document.querySelector(
      'script[src="https://widget.senja.io/widget/698903f7-82e1-43c9-a1e4-507b33742e0a/platform.js"]'
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src =
      "https://widget.senja.io/widget/698903f7-82e1-43c9-a1e4-507b33742e0a/platform.js";
    script.type = "text/javascript";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <article id="testimonials" className="bg-white py-20 sm:py-24 lg:py-32 overflow-hidden">
      <div className="max-w-7xl px-6 lg:px-8 mx-auto">
        <div
          className="senja-embed"
          data-id="698903f7-82e1-43c9-a1e4-507b33742e0a"
          data-mode="shadow"
          data-lazyload="false"
          style={{ display: "block", width: "100%" }}
        />
      </div>
    </article>
  );
}

export default Testimonials;
