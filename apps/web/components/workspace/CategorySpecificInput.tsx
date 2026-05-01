import React from 'react';

interface CategorySpecificInputProps {
    category: string;
    onSubmit: (message: string) => void;
}

export const CategorySpecificInput = ({ category, onSubmit }: CategorySpecificInputProps) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSubmit(inputValue);
            setInputValue('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border-t border-subtle">
            {category === 'coding' && (
                <CodingInput 
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleSubmit}
                />
            )}
            {category === 'drafting' && (
                <DraftingInput 
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleSubmit}
                />
            )}
            {category === 'automation' && (
                <AutomationInput 
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleSubmit}
                />
            )}
            {category === 'general' && (
                <GeneralInput 
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleSubmit}
                />
            )}
        </form>
    );
};

interface InputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

const CodingInput = ({ value, onChange, onSubmit }: InputProps) => {
    return (
        <div className="space-y-2">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Ask about code... e.g., 'How do I implement authentication?'"
                className="w-full min-h-[80px] max-h-[200px] p-3 bg-surface rounded-lg border border-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
            <div className="flex justify-between items-center">
                <button type="button" className="text-sm text-subtle hover:text-foreground">⌘K</button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    );
};

const DraftingInput = ({ value, onChange, onSubmit }: InputProps) => {
    return (
        <div className="space-y-2">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Ask about documents... e.g., 'Write a user manual for this API'"
                className="w-full min-h-[80px] max-h-[200px] p-3 bg-surface rounded-lg border border-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
            <div className="flex justify-between items-center">
                <button type="button" className="text-sm text-subtle hover:text-foreground">📄 Templates</button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Generate
                </button>
            </div>
        </div>
    );
};

const AutomationInput = ({ value, onChange, onSubmit }: InputProps) => {
    return (
        <div className="space-y-2">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Describe automation... e.g., 'Backup code daily at 2 AM'"
                className="w-full min-h-[80px] max-h-[200px] p-3 bg-surface rounded-lg border border-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
            <div className="flex justify-between items-center">
                <button type="button" className="text-sm text-subtle hover:text-foreground">⏰ Schedule</button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Create Automation
                </button>
            </div>
        </div>
    );
};

const GeneralInput = ({ value, onChange, onSubmit }: InputProps) => {
    return (
        <div className="space-y-2">
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Ask anything..."
                className="w-full min-h-[80px] max-h-[200px] p-3 bg-surface rounded-lg border border-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
            <div className="flex justify-end">
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    );
};
