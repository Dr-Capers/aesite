export function initSignupForm() {
  const form = document.querySelector('.status-card__form');
  const emailInput = document.querySelector('#email');

  if (!form || !emailInput) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const value = emailInput.value.trim();
    if (!value) {
      emailInput.focus();
      return;
    }

    const button = form.querySelector('button');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing launch…';

    // Simulate async signup to keep the experience lively.
    window.setTimeout(() => {
      form.reset();
      button.disabled = false;
      button.textContent = originalText;

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.role = 'status';
      toast.textContent = 'Thanks, captain! We will ping you before liftoff.';
      document.body.appendChild(toast);

      window.setTimeout(() => {
        toast.classList.add('toast--visible');
      }, 10);

      window.setTimeout(() => {
        toast.classList.remove('toast--visible');
        window.setTimeout(() => toast.remove(), 300);
      }, 3000);
    }, 1000);
  });
}
