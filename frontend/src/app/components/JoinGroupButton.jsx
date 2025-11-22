export default function JoinGroupButton({ groupId }) {
  const handleJoin = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Join failed')
      alert('Join request sent!')
    } catch (err) {
      console.error(err)
    }
  }

  return <button onClick={handleJoin}>Join Group</button>
}
