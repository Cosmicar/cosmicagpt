(() => {
  const root = document.querySelector('[data-plan-guide]');
  if (!root) return;

  const options = [...root.querySelectorAll('[data-plan-choice]')];
  const title = document.getElementById('chooserResultTitle');
  const description = document.getElementById('chooserResultCopy');
  const contact = document.getElementById('chooserResultLink');

  const choices = {
    mercurio: {
      name: 'Mercurio',
      title: 'Empezá por Mercurio.',
      description: 'Para lentitud, publicidad no deseada, virus y una limpieza digital. Si el caso necesita más, te lo explicamos antes de intervenir.',
      message: 'Hola, mi PC está lenta o tiene virus. Quiero consultar si Mercurio es adecuado y confirmar el alcance y precio.'
    },
    venus: {
      name: 'Venus',
      title: 'Venus puede ser tu mejor punto de partida.',
      description: 'Para una puesta a punto integral de Windows, corrección de errores y actualizaciones compatibles. El diagnóstico confirma el trabajo real.',
      message: 'Hola, mi PC tiene errores de Windows o necesita mantenimiento integral. Quiero consultar por Venus y confirmar el alcance y precio.'
    },
    'planeta-x': {
      name: 'Planeta X',
      title: 'Conocé Planeta X.',
      description: 'Para configurar programas y entornos profesionales de diseño, edición o producción. El presupuesto depende del software y el equipo.',
      message: 'Hola, necesito programas profesionales para trabajar. Quiero consultar por Planeta X y recibir un presupuesto según mi configuración.'
    }
  };

  options.forEach(option => option.addEventListener('click', event => {
    const choice = choices[option.dataset.planChoice];
    if (!choice) return;
    // En ausencia de JavaScript, el enlace lleva directamente a la tarjeta correspondiente.
    event.preventDefault();
    options.forEach(item => {
      const selected = item === option;
      item.classList.toggle('is-selected', selected);
      if (selected) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    if (title) title.textContent = choice.title;
    if (description) description.textContent = choice.description;
    if (contact) {
      contact.href = 'https://wa.me/5493883298736?text=' + encodeURIComponent(choice.message);
      contact.textContent = 'Consultar ' + choice.name + ' por WhatsApp ↗';
    }
  }));
})();
