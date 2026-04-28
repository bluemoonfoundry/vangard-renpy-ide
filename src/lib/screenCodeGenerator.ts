import type { ScreenLayoutComposition, ScreenWidget } from '@/types';

/**
 * Recursively generates Ren'Py screen language code for a widget and its children.
 *
 * Handles all widget types supported by the Screen Layout Composer:
 * - Simple widgets: text, image, textbutton, imagebutton, bar, input, null
 * - Container widgets: vbox, hbox, frame, button (each recursively renders children)
 *
 * Positioning attributes (xpos/ypos/xalign/yalign) are only rendered for top-level widgets;
 * widgets inside containers inherit layout from their parent container. Style attributes
 * and action callbacks are rendered inline on the widget declaration line.
 *
 * @param widget - The widget to render
 * @param depth - Current indentation depth (number of indent strings)
 * @param insideContainer - Whether this widget is inside a container (suppresses positioning)
 * @param indent - Indentation string (typically 4 spaces)
 * @returns Multi-line Ren'Py screen language code
 *
 * @complexity O(w) time where w = total widget count (recursive tree traversal), O(d) space where d = tree depth
 */
function generateWidget(widget: ScreenWidget, depth: number, insideContainer: boolean, indent: string): string {
    const pad = indent.repeat(depth);
    const lines: string[] = [];

    const posAttrs: string[] = [];
    if (!insideContainer) {
        if (widget.xpos !== undefined) posAttrs.push(`xpos ${widget.xpos}`);
        if (widget.ypos !== undefined) posAttrs.push(`ypos ${widget.ypos}`);
        if (widget.xalign !== undefined) posAttrs.push(`xalign ${widget.xalign}`);
        if (widget.yalign !== undefined) posAttrs.push(`yalign ${widget.yalign}`);
    }
    if (widget.style) posAttrs.push(`style "${widget.style}"`);

    const isContainer = widget.type === 'vbox' || widget.type === 'hbox' || widget.type === 'frame';
    const hasChildren = isContainer && widget.children && widget.children.length > 0;

    switch (widget.type) {
        case 'null':
            lines.push(`${pad}null`);
            break;

        case 'text':
            lines.push(`${pad}text "${widget.text ?? ''}"${posAttrs.length ? ' ' + posAttrs.join(' ') : ''}`);
            break;

        case 'image':
            lines.push(`${pad}image "${widget.imagePath ?? ''}"${posAttrs.length ? ' ' + posAttrs.join(' ') : ''}`);
            break;

        case 'textbutton':
            lines.push(`${pad}textbutton "${widget.text ?? ''}" action ${widget.action || 'Return()'}${posAttrs.length ? ' ' + posAttrs.join(' ') : ''}`);
            break;

        case 'button': {
            const attrs = widget.action ? `action ${widget.action}` : '';
            const allAttrs = [attrs, ...posAttrs].filter(Boolean).join(' ');
            if (hasChildren) {
                lines.push(`${pad}button${allAttrs ? ' ' + allAttrs : ''}:`);
                for (const child of widget.children!) {
                    lines.push(generateWidget(child, depth + 1, true, indent));
                }
            } else {
                lines.push(`${pad}button${allAttrs ? ' ' + allAttrs : ''}`);
            }
            break;
        }

        case 'imagebutton': {
            const ibAttrs = [
                widget.imagePath ? `idle "${widget.imagePath}"` : '',
                widget.action ? `action ${widget.action}` : '',
                ...posAttrs,
            ].filter(Boolean).join(' ');
            lines.push(`${pad}imagebutton${ibAttrs ? ' ' + ibAttrs : ''}`);
            break;
        }

        case 'bar':
            lines.push(`${pad}bar value AnimatedValue(0, 100)${posAttrs.length ? ' ' + posAttrs.join(' ') : ''}`);
            break;

        case 'input':
            lines.push(`${pad}input default ""${posAttrs.length ? ' ' + posAttrs.join(' ') : ''}`);
            break;

        case 'vbox':
        case 'hbox':
        case 'frame': {
            const containerAttrs = posAttrs.join(' ');
            lines.push(`${pad}${widget.type}${containerAttrs ? ' ' + containerAttrs : ''}:`);
            if (hasChildren) {
                for (const child of widget.children!) {
                    lines.push(generateWidget(child, depth + 1, true, indent));
                }
            } else {
                lines.push(`${pad}${indent}pass`);
            }
            break;
        }
    }

    return lines.join('\n');
}

/**
 * Generates complete Ren'Py screen code from a Screen Layout Composition.
 *
 * Produces a fully-formed `screen` block with:
 * - Screen declaration with name and attributes (modal, zorder)
 * - All top-level widgets recursively rendered
 * - `pass` statement if no widgets exist (empty screen)
 *
 * @param comp - The screen layout composition to render
 * @param indent - Indentation string (default: 4 spaces)
 * @returns Multi-line Ren'Py screen code ready to copy/paste into `.rpy` files
 *
 * @example
 * ```typescript
 * const code = generateScreenCode(composition);
 * // screen my_menu():
 * //     vbox:
 * //         text "Hello"
 * //         textbutton "Start" action Start()
 * ```
 *
 * @complexity O(w) time where w = total widget count, O(w) space
 */
export function generateScreenCode(comp: ScreenLayoutComposition, indent = '    '): string {
    const lines: string[] = [];

    const screenAttrs: string[] = [];
    if (comp.modal) screenAttrs.push('modal True');
    if (comp.zorder !== 0) screenAttrs.push(`zorder ${comp.zorder}`);

    lines.push(`screen ${comp.screenName}()${screenAttrs.length ? ' ' + screenAttrs.join(' ') : ''}:`);

    if (comp.widgets.length === 0) {
        lines.push(`${indent}pass`);
    } else {
        for (const widget of comp.widgets) {
            lines.push(generateWidget(widget, 1, false, indent));
        }
    }

    return lines.join('\n');
}
