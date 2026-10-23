import React, { useEffect, useRef } from 'react';
import { ArrowRightLeft, BookX, UserMinus } from 'lucide-react';

const UserContextMenu = ({
  x,
  y,
  visible,
  onClose,
  onMoveUser,
  onRemoveFromGroup,
  onRemoveFromCourse,
  userInfo,
  sessionInfo
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const choose = (action) => () => {
    action(userInfo, sessionInfo);
    onClose();
  };

  const itemClass = 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none [&_svg]:size-4 [&_svg]:text-muted-foreground';

  return (
    <div
      ref={menuRef}
      role="menu"
      className="user-context-menu min-w-56 rounded-md border border-border-strong bg-popover p-1 text-popover-foreground shadow-lg"
      // Where the person right-clicked
      style={{ position: 'fixed', top: y, left: x, zIndex: 1300 }}
    >
      <div className="border-b border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground">
        <span className="user-name">{userInfo?.name || `User ${userInfo?.userId}`}</span>
      </div>

      <div className="pt-1">
        {onMoveUser && (
          <button type="button" role="menuitem" className={itemClass} onClick={choose(onMoveUser)}>
            <ArrowRightLeft />
            <span>Move to another session...</span>
          </button>
        )}
        <button type="button" role="menuitem" className={itemClass} onClick={choose(onRemoveFromGroup)}>
          <UserMinus />
          <span>Remove from Group</span>
        </button>
        <button type="button" role="menuitem" className={itemClass} onClick={choose(onRemoveFromCourse)}>
          <BookX />
          <span>Remove from Course</span>
        </button>
      </div>
    </div>
  );
};

export default UserContextMenu;
