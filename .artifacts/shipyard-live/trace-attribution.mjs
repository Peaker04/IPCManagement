const MAX_TRACE_TREE_DEPTH = 32;
const MAX_TRACE_TREE_NODES = 4_000;
const MAX_STACK_FRAMES = 16;

const isCompleteEvent = (event) => event?.ph === 'X'
  && Number.isFinite(event.ts)
  && Number.isFinite(event.dur);

const eventEnd = (event) => event.ts + event.dur;
const contains = (parent, child) => child.ts >= parent.ts && eventEnd(child) <= eventEnd(parent);

const traceEventOwner = (event) => {
  const data = event.args?.data ?? event.args?.beginData ?? {};
  const stackFrame = Array.isArray(data.stackTrace) ? data.stackTrace[0] : null;
  return {
    name: event.name,
    duration: Number((event.dur / 1_000).toFixed(3)),
    functionName: data.functionName ?? data.function ?? stackFrame?.functionName ?? null,
    url: data.url ?? data.scriptName ?? stackFrame?.url ?? null,
  };
};

const stackFor = (event) => {
  const data = event.args?.data ?? event.args?.beginData ?? {};
  if (!Array.isArray(data.stackTrace)) return [];
  return data.stackTrace
    .filter((frame) => frame && (typeof frame.functionName === 'string' || typeof frame.url === 'string'))
    .slice(0, MAX_STACK_FRAMES)
    .map((frame) => ({ functionName: frame.functionName ?? null, url: frame.url ?? null }));
};

const buildTraceTree = (task, completeEvents) => {
  const taskEvents = completeEvents
    .filter((event) => event !== task && event.pid === task.pid && event.tid === task.tid && contains(task, event))
    .sort((left, right) => left.ts - right.ts || right.dur - left.dur)
    .slice(0, MAX_TRACE_TREE_NODES);
  const root = { event: task, children: [] };
  const nodes = [root];
  const ancestors = [root];

  for (const event of taskEvents) {
    while (ancestors.length > 1 && !contains(ancestors.at(-1).event, event)) ancestors.pop();
    const node = { event, children: [] };
    ancestors.at(-1).children.push(node);
    nodes.push(node);
    ancestors.push(node);
  }
  return nodes;
};

const scriptOwnerFor = (task, completeEvents) => {
  const nodes = buildTraceTree(task, completeEvents);
  let best = null;
  const visit = (node, depth) => {
    if (depth > MAX_TRACE_TREE_DEPTH) return;
    const stack = stackFor(node.event);
    if (stack.length > 0) {
      const candidate = { event: node.event, depth, stack };
      if (!best
        || candidate.stack.length > best.stack.length
        || (candidate.stack.length === best.stack.length && candidate.depth > best.depth)
        || (candidate.stack.length === best.stack.length && candidate.depth === best.depth && candidate.event.dur > best.event.dur)) {
        best = candidate;
      }
    }
    for (const child of node.children) visit(child, depth + 1);
  };
  visit(nodes[0], 0);
  if (!best) return null;
  return {
    ...traceEventOwner(best.event),
    traceDepth: best.depth,
    stack: best.stack,
  };
};

export const summarizeTrace = (traceEvents, route, viewport) => {
  const completeEvents = Array.isArray(traceEvents) ? traceEvents.filter(isCompleteEvent) : [];
  const longTasks = completeEvents
    .filter((event) => event.name === 'RunTask' && event.dur > 50_000)
    .map((task) => {
      const directChildren = completeEvents
        .filter((event) => event !== task && event.pid === task.pid && event.tid === task.tid && contains(task, event))
        .filter((event, _, nested) => !nested.some((other) => other !== event && contains(task, other) && contains(other, event)))
        .sort((left, right) => right.dur - left.dur);
      return {
        ...traceEventOwner(task),
        owner: directChildren[0] ? traceEventOwner(directChildren[0]) : null,
        scriptOwner: scriptOwnerFor(task, completeEvents),
      };
    });
  return {
    route: route.path,
    viewport: viewport.name,
    status: 'captured',
    eventCount: Array.isArray(traceEvents) ? traceEvents.length : 0,
    longTasks,
  };
};
