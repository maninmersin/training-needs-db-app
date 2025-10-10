import { useState } from 'react';
import { usePlanStore } from '../state/usePlanStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface SharePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SharePlanModal({ isOpen, onClose }: SharePlanModalProps) {
  const { currentPlan, sharePlan, unsharePlan } = usePlanStore();
  const [email, setEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSharing(true);
    setError(null);
    setSuccess(null);

    try {
      // In a real app, you would look up the user ID by email
      // For now, we'll use the email as a placeholder
      await sharePlan(email);
      setSuccess(`Plan shared with ${email}`);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share plan');
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async (userId: string) => {
    try {
      await unsharePlan(userId);
      setSuccess('Plan unshared successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unshare plan');
    }
  };

  if (!currentPlan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Share Plan</DialogTitle>
          <DialogDescription>
            Share "{currentPlan.title}" with others by entering their email address.
          </DialogDescription>
        </DialogHeader>

          <form onSubmit={handleShare} className="mb-4">
            <div className="flex">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 rounded-r-none"
                disabled={isSharing}
              />
              <Button
                type="submit"
                disabled={isSharing || !email.trim()}
                className="rounded-l-none"
              >
                {isSharing ? 'Sharing...' : 'Share'}
              </Button>
            </div>
          </form>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
              {success}
            </div>
          )}

          {currentPlan.sharedWith.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Shared with</h3>
              <div className="space-y-2">
                {currentPlan.sharedWith.map((userId) => (
                  <div key={userId} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-700">{userId}</span>
                    <Button
                      onClick={() => handleUnshare(userId)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}