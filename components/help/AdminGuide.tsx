import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import guideText from './UserGuideAdmin.md?raw';

const AdminGuide: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-8">
            <div className="markdown-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mb-6 mt-8 text-gray-900 dark:text-white border-b pb-3 dark:border-gray-600" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mb-4 mt-6 text-gray-800 dark:text-gray-100 border-b pb-2 dark:border-gray-700" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mb-3 mt-5 text-gray-800 dark:text-gray-100" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700 dark:text-gray-300" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700 dark:text-gray-300" {...props} />,
                        li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 dark:text-white" {...props} />,
                        em: ({ node, ...props }) => <em className="italic text-gray-700 dark:text-gray-300" {...props} />,
                        code: ({ node, inline, ...props }) =>
                            inline
                                ? <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-sm font-mono text-blue-600 dark:text-blue-400" {...props} />
                                : <code className="block bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4" {...props} />,
                        pre: ({ node, ...props }) => <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
                        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 italic text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20" {...props} />,
                        a: ({ node, ...props }) => <a className="text-blue-600 dark:text-blue-400 hover:underline" {...props} />,
                    }}
                >
                    {guideText}
                </ReactMarkdown>
            </div>
        </div>
    );
};

export default AdminGuide;