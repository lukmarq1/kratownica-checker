async function verifyAngle() {

  const input = document.getElementById('angle-input');
  const result = document.getElementById('result');

  const angle = parseInt(input.value, 10);

  if (isNaN(angle)) {
    result.innerText = 'Nieprawidłowy kąt';
    return;
  }

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ angle })
    });

    const data = await response.json();

    if (data.correct) {
      result.innerText = '✓ POPRAWNIE';
      result.className = 'success';
      return;
    }

    if (data.blocked) {
      result.innerText = 'ZABLOKOWANO';
      result.className = 'fail';
      return;
    }

    result.innerText = `BŁĄD (${data.left} prób)`;
    result.className = 'fail';

  } catch (e) {
    result.innerText = 'Błąd połączenia';
  }
}

/* TO JEST NAJWAŻNIEJSZE */
window.verifyAngle = verifyAngle;
