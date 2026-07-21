const toast = document.querySelector(".toast");
let toastTimer;

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      const original = button.textContent;
      button.textContent = "Copied";
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
      setTimeout(() => { button.textContent = original; }, 1600);
    } catch {
      window.prompt("Copy this text:", value);
    }
  });
});
