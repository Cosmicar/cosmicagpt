(() => {
  const phone = '5493883298736';
  const params = new URLSearchParams(window.location.search);
  const campaign = ['utm_source', 'utm_medium', 'utm_campaign']
    .map(key => params.get(key))
    .filter(Boolean)
    .join(' / ');

  const waUrl = (message, source) => {
    const origin = campaign ? `${source} · ${campaign}` : source;
    return `https://wa.me/${phone}?text=${encodeURIComponent(`${message}\n\nVengo desde cosmica.ar/serviciotecnico (${origin}).`)}`;
  };

  document.querySelectorAll('.st-wa').forEach(link => {
    const source = link.dataset.source || 'servicio-tecnico-jujuy';
    link.href = waUrl(link.dataset.message || 'Hola, necesito servicio técnico en Jujuy.', source);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'whatsapp_click', source });
    });
  });

  const status = document.getElementById('localStatus');
  const detail = document.getElementById('localStatusDetail');
  const card = status?.closest('.st-status-card');
  if (!status || !detail || !card) return;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Jujuy',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const weekday = parts.find(part => part.type === 'weekday')?.value || '';
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
  const minutes = hour * 60 + minute;
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const isWeekday = weekdays.includes(weekday);
  const isSaturday = weekday === 'Sat';
  const weekdayOpen = isWeekday && minutes >= 16 * 60 && minutes < 22 * 60;
  const saturdayOpen = isSaturday && minutes >= 9 * 60 && minutes < 13 * 60;
  const isOpen = weekdayOpen || saturdayOpen;

  if (isOpen) {
    card.classList.add('is-open');
    status.textContent = 'Taller abierto ahora';
    detail.textContent = isSaturday
      ? 'Hoy atendemos hasta las 13:00 en Ramírez de Velazco 111.'
      : 'Hoy atendemos hasta las 22:00 en Ramírez de Velazco 111.';
    return;
  }

  status.textContent = 'Taller cerrado ahora';
  if (isWeekday && minutes < 16 * 60) {
    detail.textContent = 'Abrimos hoy a las 16:00. Podés dejarnos tu consulta por WhatsApp.';
  } else if (weekday === 'Fri' && minutes >= 22 * 60) {
    detail.textContent = 'Abrimos el sábado a las 9:00. Podés dejarnos tu consulta por WhatsApp.';
  } else if (isWeekday) {
    detail.textContent = 'Abrimos el próximo día hábil a las 16:00. Podés dejarnos tu consulta por WhatsApp.';
  } else if (isSaturday && minutes < 9 * 60) {
    detail.textContent = 'Abrimos hoy a las 9:00. Podés dejarnos tu consulta por WhatsApp.';
  } else {
    detail.textContent = 'Abrimos el lunes a las 16:00. Podés dejarnos tu consulta por WhatsApp.';
  }
})();
