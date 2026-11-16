import type { ReadingBlock } from '@lumio/shared';
import { Info, TriangleAlert } from 'lucide-react';

/** Renders structured reading content as text. There is no HTML path into the page. */
export function ReadingLesson({ blocks }: { blocks: ReadingBlock[] }) {
  return (
    <article className="reading">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return <h3 key={index}>{block.text}</h3>;
          case 'paragraph':
            return <p key={index}>{block.text}</p>;
          case 'list':
            return (
              <ul key={index}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case 'callout': {
            const Icon = block.tone === 'warning' ? TriangleAlert : Info;
            return (
              <div
                key={index}
                className={`alert ${block.tone === 'warning' ? 'alert-warn' : 'alert-info'}`}
              >
                <Icon size={18} className="ic" aria-hidden="true" />
                <div>{block.text}</div>
              </div>
            );
          }
        }
      })}
    </article>
  );
}
