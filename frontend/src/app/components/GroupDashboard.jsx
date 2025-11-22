export default function GroupDashboard({ groupId }) {
  return (
    <div>
      <h2>Group Dashboard</h2>
      <GroupChat groupId={groupId} />
      <GroupPosts groupId={groupId} />
      <GroupEvents groupId={groupId} />
    </div>
  )
}
