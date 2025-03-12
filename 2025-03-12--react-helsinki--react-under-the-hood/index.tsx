const REACT_INTERNALS = {
  states: [] as unknown[],
  stateCursor: 0,
  promiseCache: new WeakMap<Promise<unknown>, unknown>(),
  rerender: (): void => {
    throw new Error("Called outside of render context");
  },
};

const React = {
  createElement: (tag, props, ...children) => {
    const element = { tag, props: { ...props, children } };
    console.log("createElement", element);
    return element;
  },
  useState: (initialState) => {
    console.log("useState", initialState);
    const cursor = REACT_INTERNALS.stateCursor++;
    const rerender = REACT_INTERNALS.rerender;
    let state;
    if (cursor in REACT_INTERNALS.states) {
      state = REACT_INTERNALS.states[cursor];
    } else {
      REACT_INTERNALS.states[cursor] = state =
        typeof initialState === "function" ? initialState() : initialState;
    }
    const setState = (nextState) => {
      console.log("setState", nextState);
      REACT_INTERNALS.states[cursor] = nextState;
      rerender();
    };
    return [state, setState];
  },
  use: (promise) => {
    if (REACT_INTERNALS.promiseCache.has(promise)) {
      return REACT_INTERNALS.promiseCache.get(promise);
    }
    throw promise;
  },
  Suspense: () => {},
};

interface HostConfig<T> {
  rootElement: T;
  createElement: (tag: string) => T;
  setProp: (element: T, key: string, value: unknown) => void;
  appendElement: (element: T, container: T) => void;
  appendString: (string: string, container: T) => void;
  clearElement: (element: T) => void;
}

const ReactReconciler = {
  createContainer: <T extends any>(hostConfig: HostConfig<T>) => {
    let _rerender = () => {};
    const render = (node, container) => {
      console.log("render", node);
      if (["string", "number"].includes(typeof node)) {
        hostConfig.appendString(String(node), container);
        return;
      }
      if (Array.isArray(node)) {
        for (const member of node) {
          render(member, container);
        }
        return;
      }
      if (node.tag === React.Suspense) {
        try {
          render(node.props.children, container);
          return;
        } catch (error) {
          if (error instanceof Promise) {
            const promise = error;
            promise.then((value) => {
              REACT_INTERNALS.promiseCache.set(promise, value);
              _rerender();
            });
            if (node.props.fallback) {
              render(node.props.fallback, container);
            }
            return;
          }
          throw error;
        }
      }
      if (typeof node.tag === "function") {
        const __rerender = REACT_INTERNALS.rerender;
        REACT_INTERNALS.rerender = _rerender;
        const evaulatedComponent = node.tag(node.props);
        REACT_INTERNALS.rerender = __rerender;
        render(evaulatedComponent, container);
        return;
      }
      const actualElement = hostConfig.createElement(node.tag);
      const { children, ...props } = node.props;
      for (const key in props) {
        hostConfig.setProp(actualElement, key, props[key]);
      }
      for (const child of children) {
        render(child, actualElement);
      }
      hostConfig.appendElement(actualElement, container);
    };
    return {
      render: (element) => {
        _rerender = () => {
          REACT_INTERNALS.stateCursor = 0;
          hostConfig.clearElement(hostConfig.rootElement);
          render(element, hostConfig.rootElement);
        };
        render(element, hostConfig.rootElement);
      },
    };
  },
};

const ReactDOM = {
  createRoot: (rootElement: HTMLElement) => {
    return ReactReconciler.createContainer({
      rootElement,
      createElement: (tag) => {
        return document.createElement(tag);
      },
      setProp: (element, key, value) => {
        element[key] = value;
      },
      appendElement: (element, container) => {
        container.appendChild(element);
      },
      appendString: (string, container) => {
        container.appendChild(document.createTextNode(string));
      },
      clearElement: (element) => {
        element.innerHTML = "";
      },
    });
  },
};

const App = () => {
  // let value = "hehe";
  // let setValue = () => {};
  // if (Math.random() > 0.5) {
  //   [value, setValue] = React.useState("");
  // }
  const [value, setValue] = React.useState("");
  const [count, setCount] = React.useState(0);
  const [dogUrlPromise] = React.useState(() =>
    fetch("https://dog.ceo/api/breeds/image/random")
      .then((response) => response.json())
      .then((data) => data.message)
  );
  const dogUrl = React.use(dogUrlPromise);
  return (
    <div className="wrapper">
      <h1>Hello, React Helsinki!</h1>
      <p>How're y'all doing tonight?</p>
      <form>
        <label>
          Here you can write:
          <input
            style="margin-inline-start: 0.5rem"
            placeholder="Bla, bla, bla…"
            value={value}
            onchange={(event) => setValue(event.target.value)}
          />
        </label>
      </form>
      <p>
        <b>This is what you wrote: </b>
        {value}
      </p>
      <p>
        <b>Count: </b>
        {count}
      </p>
      <div>
        <button type="button" onclick={() => setCount(count + 1)}>
          Increment
        </button>
        <button type="button" onclick={() => setCount(count - 1)}>
          Decrement
        </button>
      </div>
      <p>
        <b>Dog URL: </b>
        {dogUrl}
      </p>
      <img style="width: 8rem" alt="GOOD BOYYEEEEE!!" src={dogUrl} />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.Suspense fallback={<span>Loading…</span>}>
    <App />
  </React.Suspense>
);
