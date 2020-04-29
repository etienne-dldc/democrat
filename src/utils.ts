import { DEMOCRAT_ELEMENT, DEMOCRAT_CONTEXT, DEMOCRAT_ROOT } from './symbols';
import {
  Component,
  DependencyList,
  Props,
  AllOptional,
  Context,
  DemocratElement,
  DemocratContextProvider,
  ContextProviderProps,
  ResolveType,
  DemocratElementComponent,
  DemocratElementProvider,
  TreeElementType,
  TreeElementCommon,
  TreeElementData,
  TreeElement,
  DemocratRootElement,
  HooksData,
  OnIdle,
  TreeElementPath,
  Patch,
  Patches,
} from './types';

export function isValidElement(maybe: any): maybe is DemocratElement<any, any> {
  return maybe && maybe[DEMOCRAT_ELEMENT] === true;
}

export function isRootElement(maybe: any): maybe is DemocratRootElement {
  return maybe && maybe[DEMOCRAT_ELEMENT] === true && maybe[DEMOCRAT_ROOT] === true;
}

// export function createElement<P, T>(
//   context: DemocratContextConsumer<P>,
//   props: ContextConsumerProps<P, T>
// ): DemocratElement<P, ResolveType<T>>;
export function createElement<P, T>(
  component: Component<P, T>,
  props: Props<P>
): DemocratElement<P, T>;
export function createElement<P, T>(
  context: DemocratContextProvider<P>,
  props: ContextProviderProps<P, T>
): DemocratElement<P, ResolveType<T>>;
export function createElement<P, T>(
  component: Component<P, T>,
  props?: Props<P>
): AllOptional<P> extends true ? DemocratElement<P, T> : { typeError: 'Props are required !' };
export function createElement<P, T>(
  component: Component<P, T> | DemocratContextProvider<P>,
  props: Props<P> = {} as any
): AllOptional<P> extends true ? DemocratElement<P, T> : { typeError: 'Props are required !' } {
  const key = props.key;
  delete props.key;
  const element: DemocratElement<P, T> = {
    [DEMOCRAT_ELEMENT]: true,
    type: component as any,
    props: props,
    key,
  };
  return element as any;
}

export function objectShallowEqual(
  deps1: { [key: string]: any } | undefined,
  deps2: { [key: string]: any } | undefined
): boolean {
  if (deps1 === deps2) {
    return true;
  }
  if (deps1 === undefined || deps2 === undefined) {
    return false;
  }
  const keys = Object.keys(deps1);
  if (!arrayShallowEqual(keys, Object.keys(deps2))) {
    return false;
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!Object.is(deps1[key], deps2[key])) {
      return false;
    }
  }
  return true;
}

export function sameObjectKeys(
  obj1: { [key: string]: any },
  obj2: { [key: string]: any }
): boolean {
  return arrayShallowEqual(Object.keys(obj1).sort(), Object.keys(obj2).sort());
}

export function depsChanged(
  deps1: DependencyList | undefined,
  deps2: DependencyList | undefined
): boolean {
  if (deps1 === undefined || deps2 === undefined) {
    return true;
  }
  if (deps1.length !== deps2.length) {
    return true;
  }
  return !arrayShallowEqual(deps1, deps2);
}

export function mapObject<T extends { [key: string]: any }, U>(
  obj: T,
  mapper: (v: T[keyof T], key: string) => U
): { [K in keyof T]: U } {
  return Object.keys(obj).reduce((acc, key) => {
    (acc as any)[key] = mapper(obj[key], key);
    return acc;
  }, {} as { [K in keyof T]: U });
}

export const globalSetTimeout: typeof window.setTimeout = setTimeout as any;
export const globalClearTimeout: typeof window.clearTimeout = clearTimeout as any;

export function mapMap<K, V, U>(source: Map<K, V>, mapper: (v: V, k: K) => U): Map<K, U> {
  const result = new Map<K, U>();
  source.forEach((v, k) => {
    result.set(k, mapper(v, k));
  });
  return result;
}

// export function mapSet<V, U>(source: Set<V>, mapper: (v: V) => U): Set<U> {
//   const result = new Set<U>();
//   source.forEach(v => {
//     result.add(mapper(v));
//   });
//   return result;
// }

export function createContext<T>(): Context<T, false>;
export function createContext<T>(defaultValue: T): Context<T, true>;
export function createContext<T>(defaultValue?: T): Context<T, boolean> {
  const context: Context<T, boolean> = {
    [DEMOCRAT_CONTEXT]: {
      hasDefault: defaultValue !== undefined && arguments.length === 1,
      defaultValue: defaultValue as any, // force undefined when there a no default value
    },
    // Consumer: {
    //   [DEMOCRAT_CONTEXT]: 'CONSUMER',
    //   context: null as any,
    // },
    Provider: {
      [DEMOCRAT_CONTEXT]: 'PROVIDER',
      context: null as any,
    },
  };
  // context.Consumer.context = context;
  context.Provider.context = context;
  return context;
}

export function isComponentElement(
  element: DemocratElement<any, any>
): element is DemocratElementComponent<any, any> {
  return typeof element.type === 'function';
}

export function isProviderElement(
  element: DemocratElement<any, any>
): element is DemocratElementProvider<any, any> {
  return typeof element.type !== 'function' && element.type[DEMOCRAT_CONTEXT] === 'PROVIDER';
}

// export function isConsumerElement(
//   element: DemocratElement<any, any>
// ): element is DemocratElementConsumer<any, any> {
//   return typeof element.type !== 'function' && element.type[DEMOCRAT_CONTEXT] === 'CONSUMER';
// }

const nextId = (() => {
  let id = 0;
  return () => id++;
})();

export function createTreeElement<T extends TreeElementType>(
  type: T,
  parent: TreeElement,
  path: TreeElementPath,
  data: Omit<TreeElementCommon, 'id' | 'state' | 'parent' | 'root' | 'path'> & TreeElementData[T]
): TreeElement<T> {
  const id = nextId();
  return {
    type,
    id,
    state: 'created',
    path,
    parent,
    root: parent.type === 'ROOT' ? parent : parent.root,
    ...data,
  } as any;
}

export function createRootTreeElement(data: {
  onIdle: OnIdle;
  passiveMode: boolean;
  requestRender: (patch: Patch | null) => void;
  applyPatches: (patches: Patches) => void;
}): TreeElement<'ROOT'> {
  let reactHooksSupported: boolean = false;
  let renderingStack: Array<TreeElement> = [];

  const rootTreeElement: TreeElement<'ROOT'> = {
    type: 'ROOT',
    id: nextId(),
    mounted: false,
    state: 'created',
    root: null as any,
    path: null as any,
    parent: null as any,
    value: null,
    previous: null,
    children: null as any,
    context: new Map(),
    supportReactHooks,
    findProvider,
    isRendering,
    markDirty,
    withGlobalRenderingInstance,
    getCurrentRenderingChildInstance,
    getCurrentHook,
    getCurrentHookIndex,
    setCurrentHook,
    ...data,
  };

  rootTreeElement.root = rootTreeElement;

  return rootTreeElement;

  function markDirty(instance: TreeElement<'CHILD'>, limit: TreeElement | null = null) {
    let current: TreeElement | null = instance;
    while (current !== null && current !== limit) {
      if (current.type === 'CHILD') {
        if (current.dirty === true) {
          break;
        }
        current.dirty = true;
      }
      current = current.parent;
    }
  }

  function findProvider(context: Context<any>): TreeElement<'PROVIDER'> | null {
    for (let i = renderingStack.length - 1; i >= 0; i--) {
      const instance = renderingStack[i];
      if (instance.type === 'PROVIDER' && instance.element.type.context === context) {
        return instance;
      }
    }
    return null;
  }

  function isRendering(): boolean {
    return renderingStack.length > 0;
  }

  function supportReactHooks(ReactInstance: any, hooks: any) {
    if (reactHooksSupported === false) {
      reactHooksSupported = true;
      const methods = [
        'useState',
        'useReducer',
        'useEffect',
        'useMemo',
        'useCallback',
        'useLayoutEffect',
        'useRef',
      ];
      methods.forEach(name => {
        const originalFn = ReactInstance[name];
        ReactInstance[name] = (...args: Array<any>) => {
          if (isRendering()) {
            return (hooks as any)[name](...args);
          }
          return originalFn(...args);
        };
      });
    }
  }

  function withGlobalRenderingInstance<T>(current: TreeElement, exec: () => T): T {
    renderingStack.push(current);
    const result = exec();
    renderingStack.pop();
    return result;
  }

  function getCurrentRenderingChildInstance(): TreeElement<'CHILD'> {
    if (renderingStack.length === 0) {
      throw new Error(`Hooks used outside of render !`);
    }
    const currentInstance = renderingStack[renderingStack.length - 1];
    if (currentInstance.type !== 'CHILD') {
      throw new Error(`Current rendering instance is not of type CHILD`);
    }
    return currentInstance;
  }

  function getCurrentHook(): HooksData | null {
    const instance = getCurrentRenderingChildInstance();
    if (instance.hooks && instance.hooks.length > 0) {
      return instance.hooks[instance.nextHooks.length] || null;
    }
    return null;
  }

  function getCurrentHookIndex(): number {
    const instance = getCurrentRenderingChildInstance();
    if (instance.nextHooks) {
      return instance.nextHooks.length;
    }
    return 0;
  }

  function setCurrentHook(hook: HooksData) {
    const instance = getCurrentRenderingChildInstance();
    instance.nextHooks.push(hook);
  }
}

/**
 * Array have the same structure if
 *  - they have the same length
 *  - the keys have not moved
 */
export function sameArrayStructure(prev: Array<TreeElement>, children: Array<any>): boolean {
  if (prev.length !== children.length) {
    return false;
  }
  const prevKeys = prev.map(item => (item.type === 'CHILD' ? item.element.key : undefined));
  const childrenKeys = children.map(item => (isValidElement(item) ? item.key : undefined));
  return arrayShallowEqual(prevKeys, childrenKeys);
}

export function sameMapStructure(prev: Map<any, TreeElement>, children: Map<any, any>): boolean {
  if (prev.size !== children.size) {
    return false;
  }
  let allIn = true;
  prev.forEach((_v, k) => {
    if (allIn === true && children.has(k) === false) {
      allIn = false;
    }
  });
  return allIn;
}

export function registerContextSub(instance: TreeElement<'CHILD'>, context: Context<any>) {
  const root = instance.root!;
  if (!root.context.has(context)) {
    root.context.set(context, new Set());
  }
  root.context.get(context)!.add(instance);
}

export function unregisterContextSub(instance: TreeElement<'CHILD'>, context: Context<any>) {
  const root = instance.root!;
  if (!root.context.has(context)) {
    return;
  }
  const ctx = root.context.get(context)!;
  ctx.delete(instance);
  if (ctx.size === 0) {
    root.context.delete(context);
  }
}

export function markContextSubDirty(instance: TreeElement, context: Context<any>) {
  const root = instance.root!;
  const ctx = root.context.get(context);
  if (ctx) {
    ctx.forEach(c => {
      if (isDescendantOf(c, instance)) {
        root.markDirty(c, instance);
      }
    });
  }
}

export function isElementInstance(
  instance: TreeElement
): instance is TreeElement<'CHILD' | 'PROVIDER'> {
  if (instance.type === 'CHILD' || instance.type === 'PROVIDER') {
    return true;
  }
  return false;
}

export function getInstanceKey(instance: TreeElement): string | number | undefined {
  return isElementInstance(instance) ? instance.element.key : undefined;
}

export function getPatchPath(instance: TreeElement): Array<TreeElementPath> {
  let path: Array<TreeElementPath> = [];
  let current: TreeElement | null = instance;
  while (current !== null && current.type !== 'ROOT') {
    path.unshift(current.path);
    if (current.parent === undefined) {
      console.log(current);
    }
    current = current.parent;
  }
  return path;
}

export function isPlainObject(o: any): o is object {
  let ctor, prot;

  if (isObjectObject(o) === false) return false;

  // If has modified constructor
  ctor = o.constructor;
  if (typeof ctor !== 'function') return false;

  // If has modified prototype
  prot = ctor.prototype;
  if (isObjectObject(prot) === false) return false;

  // If constructor does not have an Object-specific method
  if (prot.hasOwnProperty('isPrototypeOf') === false) {
    return false;
  }

  // Most likely a plain Object
  return true;
}

function isObject(val: any) {
  return val != null && typeof val === 'object' && Array.isArray(val) === false;
}

function isObjectObject(o: any) {
  return isObject(o) === true && Object.prototype.toString.call(o) === '[object Object]';
}

function arrayShallowEqual(deps1: ReadonlyArray<any>, deps2: ReadonlyArray<any>): boolean {
  if (deps1 === deps2) {
    return true;
  }
  if (deps1.length !== deps2.length) {
    return false;
  }
  for (let i = 0; i < deps1.length; i++) {
    const dep = deps1[i];
    if (!Object.is(dep, deps2[i])) {
      return false;
    }
  }
  return true;
}

function isDescendantOf(instance: TreeElement, parent: TreeElement) {
  let current: TreeElement | null = instance;
  while (current !== null && current !== parent) {
    current = current.parent;
  }
  return current === parent;
}
