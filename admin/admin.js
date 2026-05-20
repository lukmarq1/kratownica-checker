async function loadLogs() {

  const response =
    await fetch('/api/admin/logs');

  const logs =
    await response.json();

  const div =
    document.getElementById('logs');

  div.innerHTML = '';

  logs.forEach(log => {

    const row =
      document.createElement('div');

    row.innerHTML = `
      <hr>
      <b>${log.status}</b><br>
      ${log.ip}<br>
      ${log.angle}<br>
      ${log.created_at}
    `;

    div.appendChild(row);
  });
}

loadLogs();