import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadNotifications } from './lib/notifications.js'
import './notifications.css'

export default function NotificationCenter() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const refresh = async () => {
    try { setItems(await loadNotifications()); setError('') }
    catch (cause) { setError(cause.message || 'Não foi possível carregar os alertas.') }
  }
  useEffect(() => { refresh() }, [])
  const high = items.filter(item => item.level === 'high').length
  return <div className="notification-center">
    <button className="notification-bell" type="button" aria-label="Notificações" onClick={() => setOpen(!open)}>♢{items.length > 0 && <em>{items.length}</em>}</button>
    {open && <section className="notification-panel">
      <div className="notification-title"><div><b>Notificações</b><small>{high} alerta(s) prioritário(s)</small></div><button type="button" onClick={refresh}>Actualizar</button></div>
      {error && <p className="notification-error">{error}</p>}
      {!items.length && !error && <div className="notification-empty"><b>Sem alertas</b><p>Não existem acções urgentes.</p></div>}
      <div className="notification-list">{items.map(item => <button type="button" className={`notification-item ${item.level}`} key={item.id} onClick={() => { setOpen(false); navigate(item.path) }}><span>{item.level === 'high' ? '!' : '•'}</span><div><b>{item.title}</b><small>{item.detail}</small></div></button>)}</div>
    </section>}
  </div>
}
