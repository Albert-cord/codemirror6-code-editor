import React, { useState, useRef } from "react";
import { CSSProperties, PropsWithChildren, ReactNode } from "react";
import {
  useInteractions,
  useFloating,
  useClick,
  useDismiss,
  offset,
  arrow,
  FloatingArrow,
  flip,
  useHover,
} from "@floating-ui/react";
import "./index.css";
import './expression-parse';
type Alignment = "start" | "end";
type Side = "top" | "right" | "bottom" | "left";
type AlignedPlacement = `${Side}-${Alignment}`;

export interface FullRichTextAreaProps {
  // content: ReactNode,
  trigger?: "hover" | "click";
  placement?: Side | AlignedPlacement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
  value?: string;
  onChange?: (val?: string) => void;
}

const allowFullRichTextAreaKeyReg = /[\d+\-*/^%. ]+/g;

const functionKeys = ['Backspace', 'Delete', 'PageUp', 'PageDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Alt', 'Tab', 'Fn', 'Ctrl', 'Enter', 'Home', 'End', 'Meta', 'CapsLock', 'Esc'];
const deleteKeys = ['Backspace', 'Delete'];
// TODO：
// function checkKey

const indexes = [
  {
    value: 'Max(,)',
    cursorOffset: 4,
    regexp: /Max\([\s\w,()]*\)/g
  },
  {
    value: 'Min(,)',
    cursorOffset: 4,
    regexp: /Min\([\s\w,()]*\)/g
  },
  {
    value: '沪深300',
    cursorOffset: 5,
  },
  {
    value: '中证500',
    cursorOffset: 5,
  },
  {
    value: '上证50',
    cursorOffset: 4,
  },
  {
    value: '银行活期利率',
    cursorOffset: 6,
  },
  {
    value: '年化%',
    cursorOffset: 2,
    regexp: /年化[\s\S]+%$/g
  },
]

interface CheckIncludeKeyArgs {
  key: string, str: string, cursorIndex: number, direction?: 'backword' | 'forward',
  regexp?: RegExp;
}

function findEnclosingMaxIndex(input: string): { startIndex: number, endIndex: number } | null {
  const cursorIndex = input.indexOf('$$');
  if (cursorIndex === -1) {
      return null; // No cursor found
  }

  // Remove the cursor placeholder for simpler processing
  input = input.replace('$$', '');

  const pattern = /Max\((?:[^()]+|\([^()]*\))*\)/g;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;

  while ((match = pattern.exec(input)) !== null) {
      if (match.index <= cursorIndex && pattern.lastIndex >= cursorIndex) {
          lastMatch = match;
          // break;
      }
      console.log('match', match);
  }

  if (lastMatch) {
      return {
          startIndex: lastMatch.index,
          endIndex: lastMatch.index + lastMatch[0].length
      };
  }

  return null;
}

// 测试示例
const input = 'Max(Max(a, b, c), d, $$e, f, Max(g,h), j,k)';
const result = findEnclosingMaxIndex(input);
if (result) {
  console.log(`Start Index: ${result.startIndex}, End Index: ${result.endIndex}`);
} else {
  console.log('No enclosing Max function found for the cursor position.');
}


function checkIncludeKey(args: CheckIncludeKeyArgs) {
  const {key, str, cursorIndex, direction = 'backword', regexp} = args;
  if(!regexp) {
    if(direction === 'forward') {
      return str.slice(cursorIndex, key.length) === str;
    } else {
      return str.slice(cursorIndex, key.length) === str;
    }
  } else {
    if(direction === 'forward') {
      return str.slice(cursorIndex, key.length) === str;
    } else {
      return str.slice(cursorIndex, key.length) === str;
    }
  }
}

interface IHandleCursorResult {
  value?: string;
  cursorPos?: number;
  isHandle: boolean;
}

type HandleCursorResult = IHandleCursorResult | undefined | null;


function LimitedStack<T>(initialValue: T[] = [], limitLength: number = 100) {

  const backwardStack = initialValue;
  const forwardStack: T[] = [];
  const push = (arr: T[], item?: T) => {
    if(item) {
      if(arr.length >= limitLength) {
        arr.shift();
      }
      arr.push(item);
    }
  }
  return {
    go(value: T) {
      forwardStack.length = 0;
      push(backwardStack, value);
    },
    backward() {
      const item = backwardStack.pop();
      push(forwardStack, item);
      return item;
    },
    forward() {
      const item = forwardStack.pop();
      push(backwardStack, item);
      return item;
    },
  }
}

interface DefineModel {
  /** 名称 */
  name: '沪深300' | '中证500' | '上证50' | '银行活期利率' | 'Max(,)' | 'Min(,)' | '年化利率%' | 'numberal';
  /** 起始 */
  from: number;
  /** 截止 */
  to: number;
  /** 值 */
  value: string;
}

export function BaseFullRichTextArea(props: FullRichTextAreaProps) {
  const {
    open,
    onOpenChange,
    // content,
    value,
    trigger = "hover",
    placement = "bottom",
    className,
    style,
    onChange,
  } = props;
  const content = (
    <div>
      {
        indexes.map(item => {
          return (
            <div onMouseDown={() => {
              blurTimerRef.current && window.clearTimeout(blurTimerRef.current);
              const selectionStart = textAreaRef.current?.selectionStart;
              const selectionEnd = textAreaRef.current?.selectionEnd;
              onChange?.(`${value?.slice(0, selectionStart) ?? ''}${item.value}${value?.slice(selectionEnd) ?? ''}`)
              window.setTimeout(() => {
                  if(textAreaRef?.current) {
                  textAreaRef.current.selectionStart = (selectionStart ?? 0) + item.cursorOffset;
                  textAreaRef.current.selectionEnd = (selectionStart ?? 0) + item.cursorOffset;
                  textAreaRef.current.focus();
                }
                })
            }}>{item.value}</div>
          )
        })
      }
    </div>
  );
  const arrowRef = useRef(null);

  const [_isOpen, setIsOpen] = useState(open);
  const [focused, setFocused] = useState(false);
  const isOpen = _isOpen || focused;
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open: boolean) => {
      blurTimerRef.current && window.clearTimeout(blurTimerRef.current);
      setIsOpen(open);
      onOpenChange?.(open);
    },
    placement,
    middleware: [
      offset(10),
      arrow({
        element: arrowRef,
      }),
      flip(),
    ],
  });

  // const hoverInteraction = useHover(context);
  const clickInteraction = useClick(context);

  // const interaction = trigger === "hover" ? hoverInteraction : clickInteraction;

  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    clickInteraction,
    dismiss,
  ]);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const blurTimerRef = useRef(0);

  const handleArrowRight = (value: string, cursorPos: number): HandleCursorResult => {

  }

  const handleArrowLeft = (value: string, cursorPos: number): HandleCursorResult => {

  }
  // 不监听Up Down

  const handleDelete = (value: string, cursorPos: number):HandleCursorResult => {

  }

  const handleBackspace = (value: string, cursorPos: number):HandleCursorResult => {

  }

  const stackRef = useRef<ReturnType<typeof LimitedStack>>(null!);
  if(!stackRef.current) {
    stackRef.current = LimitedStack<Omit<IHandleCursorResult, 'isHandle'>>();
  }


  return (
    <>
      <textarea
        className="textarea"
        ref={(node) => {
          refs.setReference(node);
          textAreaRef.current = node;
        }}
        {...getReferenceProps()}
        style={style}
        value={value}
        onChange={(e) => {
          const text: string = e.target.value;
          onChange?.(text);
          const selectionStart = textAreaRef.current?.selectionStart;
          const selectionEnd = textAreaRef.current?.selectionEnd;
          console.info('text', text, selectionStart, selectionEnd);
          console.info('select', text.slice(0, selectionStart), text.slice(selectionStart, selectionEnd))
        }}
        onSelect={(e) => {
          console.info('onSelect', e);
        }}
        onKeyDown={(e) => {
            // ???
            if(focused) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const key = e.key;
                const cursorPos = textAreaRef.current?.selectionStart ?? 0;
                const value = textAreaRef.current?.value ?? '';
                if(deleteKeys.includes(key)) {
                  let result = null;
                  if (key === 'ArrowRight') {
                    result = handleArrowRight(value, cursorPos);
                  } else if (key === 'ArrowLeft') {
                    result = handleArrowLeft(value, cursorPos);
                  } else if (key === 'Backspace') {
                    result = handleBackspace(value, cursorPos);
                  } else if (key === 'Delete') {
                    result = handleDelete(value, cursorPos);
                  }
                  const handled = result?.isHandle;
      
                  if (handled) {
                      e.preventDefault();
                  }
                }
                // ???
                // 不判断非数字及其他文字
                // if(!allowFullRichTextAreaKeyReg.test(key) && !functionKeys.includes(key)) {
                //     // ???
                //     e.preventDefault();
                //     console.info("preventDefault onKeyDown", focused, e);
                //     return;
                // }
                console.info("onKeyDown", e, key, allowFullRichTextAreaKeyReg.test(key));
                
            }
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          blurTimerRef.current && window.clearTimeout(blurTimerRef.current);
          blurTimerRef.current = window.setTimeout(() => {
            setFocused(false);
          }, 10)
        }}
      />
      {isOpen && (
        <div
          className="popover-floating"
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        >
          {content}
          <FloatingArrow
            ref={arrowRef}
            context={context}
            fill="#fff"
            stroke="#000"
            strokeWidth={1}
          />
        </div>
      )}
    </>
  );
}

export function FullRichTextArea() {
  const [value, setValue] = useState("");

  return (
    <BaseFullRichTextArea
      trigger="click"
      value={value}
      onChange={(v) => setValue(v ?? "")}
    />
  );
}
