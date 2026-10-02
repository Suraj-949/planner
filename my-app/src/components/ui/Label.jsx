// Small uppercase field label used by the create-task panel and filter selects.
const Label = ({ children, className = '', htmlFor }) => {
    return (
        <label htmlFor={htmlFor} className={`label-xs ${className}`}>
            {children}
        </label>
    )
}

export default Label
