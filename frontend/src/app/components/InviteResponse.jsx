export default function InviteResponse({ groupId }) {
  const handleAccept = async () => {
    await fetch(`/api/groups/${groupId}/invite/accept`, {
      method: 'POST',
      credentials: 'include',
    })
    alert('You joined the group!')
    window.location.reload()
  }

  const handleReject = async () => {
    await fetch(`/api/groups/${groupId}/invite/reject`, {
      method: 'POST',
      credentials: 'include',
    })
    alert('Invitation declined.')
    window.location.reload()
  }

  return (
    <div>
      <p>You are invited to this group</p>
      <button onClick={handleAccept}>Accept</button>
      <button onClick={handleReject}>Reject</button>
    </div>
  )
}
