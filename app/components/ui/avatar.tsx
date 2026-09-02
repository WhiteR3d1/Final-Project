export type AvatarUser = {
  id: string;
  name: string | null;
  email: string;
};

const AVATAR_COLORS = ["#8b7cff", "#4dabff", "#2fd4a0", "#ffcc4d", "#ff8f6b", "#ff6b9d"];

export function displayName(user: AvatarUser) {
  return user.name ?? user.email;
}

/** สีประจำตัวคนหนึ่ง ๆ คงที่เสมอ (hash จาก id) จะได้จำหน้ากันได้ */
function colorFor(user: AvatarUser) {
  let hash = 0;
  for (const char of user.id) hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

export function Avatar({
  user,
  size = 24,
  muted = false,
}: {
  user: AvatarUser;
  size?: number;
  muted?: boolean;
}) {
  const label = displayName(user);
  const color = colorFor(user);

  return (
    <span
      title={label}
      aria-label={label}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        backgroundColor: muted ? "transparent" : `${color}26`,
        color,
        borderColor: color,
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${
        muted ? "border border-dashed opacity-60" : ""
      }`}
    >
      {label[0]?.toUpperCase()}
    </span>
  );
}

export function AvatarStack({
  users,
  max = 3,
  size = 24,
}: {
  users: AvatarUser[];
  max?: number;
  size?: number;
}) {
  if (users.length === 0) return null;

  const shown = users.slice(0, max);
  const rest = users.length - shown.length;

  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((user) => (
        <span key={user.id} className="ring-panel rounded-full ring-2">
          <Avatar user={user} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
          className="bg-panel-2 text-muted ring-panel inline-flex items-center justify-center rounded-full font-medium ring-2"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
