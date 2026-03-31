const buttons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.view;

    buttons.forEach((btn) => btn.classList.remove("active"));
    views.forEach((view) => view.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(target)?.classList.add("active");
  });
});
