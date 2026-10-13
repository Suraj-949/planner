import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'

/*
 * Confirmation dialog, used before destructive actions.
 *
 * `onConfirm` may return a promise, in which case the dialog stays open and disables its
 * buttons until it settles. Closing early would make a failure look like a success and
 * leave the user with no idea which of two tasks was deleted.
 *
 * The caller keys this component on the record being confirmed, so switching targets
 * remounts it and `isPending` starts over without an effect that resets state. Focus starts
 * on Cancel: the dialog opens on the same keystroke as the click, so a second Enter would
 * otherwise confirm immediately.
 */
const ConfirmDialog = ({
    open,
    title,
    children,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = true,
    onConfirm,
    onCancel,
}) => {
    const [isPending, setIsPending] = useState(false)

    const handleConfirm = async () => {
        if (isPending) return

        try {
            setIsPending(true)
            await onConfirm()
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Modal
            open={open}
            onClose={isPending ? () => {} : onCancel}
            labelledBy="confirm-dialog-title"
            initialFocus="first"
        >
            <div className="p-4">
                <h2 id="confirm-dialog-title" className="text-sm font-semibold text-content">
                    {title}
                </h2>

                <div className="mt-1.5 text-sm text-content-muted">{children}</div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="subtle" size="sm" onClick={onCancel} disabled={isPending}>
                        {cancelLabel}
                    </Button>

                    <Button
                        variant={destructive ? 'danger' : 'primary'}
                        size="sm"
                        onClick={handleConfirm}
                        disabled={isPending}
                    >
                        {isPending ? 'Working…' : confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

export default ConfirmDialog
