# LangChain / LangGraph Standards

Detected via `langchain` or `langgraph` in `requirements.txt` / `pyproject.toml` — auto-injected as **extra**.

## What It Is

**LangChain** — Python framework for composing LLM applications (prompts, chains, agents, retrievers, memory).
**LangGraph** — graph-based agent orchestration built on LangChain. State machines for multi-step agent workflows.

## Modern Stack (2026)

The ecosystem has split into focused packages:

```bash
pip install langchain langchain-openai langchain-anthropic langgraph langsmith
```

| Package | Purpose |
|---|---|
| `langchain-core` | Base abstractions (Runnable, Message, Tool) |
| `langchain` | Higher-level chains, agents |
| `langchain-openai` / `-anthropic` / `-google` | Provider integrations |
| `langgraph` | Stateful agent graphs |
| `langsmith` | Tracing + observability (free tier OK for solo) |

## LCEL — LangChain Expression Language

Compose chains with the pipe operator:

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{question}"),
])

model = ChatAnthropic(model="claude-opus-4-7", temperature=0)
parser = StrOutputParser()

chain = prompt | model | parser

result = chain.invoke({"question": "What is the capital of France?"})
# → "Paris."
```

`|` (pipe) is the heart of LCEL — runnables compose into pipelines.

## Streaming

```python
for chunk in chain.stream({"question": "Tell me a story"}):
    print(chunk, end="", flush=True)

# Async
async for chunk in chain.astream({"question": "..."}):
    yield chunk
```

Always stream user-facing LLM responses — perceived latency drops dramatically.

## Structured Output

```python
from pydantic import BaseModel, Field

class Person(BaseModel):
    name: str
    age: int = Field(ge=0, le=120)
    role: str

structured_model = model.with_structured_output(Person)
result = structured_model.invoke("Extract: John is a 30-year-old engineer")
# → Person(name='John', age=30, role='engineer')
```

Backed by tool-use or function-calling per provider. Use this instead of regex-parsing free-text.

## Tools

```python
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    return f"Sunny in {city}, 72°F"

@tool
def search_db(query: str, limit: int = 10) -> list[dict]:
    """Search the user database."""
    return db.users.find(query)[:limit]

tools = [get_weather, search_db]
model_with_tools = model.bind_tools(tools)
```

Tool docstrings + type hints become the function spec the model sees. Be specific.

## RAG (Retrieval-Augmented Generation)

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 1. Load + split docs
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(documents)

# 2. Embed + store
vectorstore = Chroma.from_documents(chunks, OpenAIEmbeddings())

# 3. Retrieve
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# 4. Chain: retrieve → context → answer
from langchain_core.runnables import RunnablePassthrough

rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | model
    | parser
)

answer = rag_chain.invoke("What did the user ask?")
```

Production: replace Chroma with **Pinecone**, **Qdrant**, **Weaviate**, or **pgvector**.

## LangGraph — Agents as State Machines

For non-trivial agents with loops, branches, tool calls:

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
from operator import add

class AgentState(TypedDict):
    messages: Annotated[list, add]      # append-only list
    next_action: str

def call_model(state: AgentState) -> dict:
    response = model.invoke(state["messages"])
    return {"messages": [response]}

def call_tool(state: AgentState) -> dict:
    tool_call = state["messages"][-1].tool_calls[0]
    result = tools_map[tool_call["name"]].invoke(tool_call["args"])
    return {"messages": [{"role": "tool", "content": str(result)}]}

def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    return "tool" if last.tool_calls else END

workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tool", call_tool)
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tool": "tool", END: END})
workflow.add_edge("tool", "agent")

app = workflow.compile()
app.invoke({"messages": [HumanMessage("...")]})
```

LangGraph supports checkpointing — pause + resume agents, multi-turn conversations, human-in-the-loop.

## Memory

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver   # production

checkpointer = MemorySaver()      # in-process for dev
app = workflow.compile(checkpointer=checkpointer)

# Resume conversation via thread_id
config = {"configurable": {"thread_id": "user-123"}}
app.invoke({"messages": [...]}, config=config)
```

## Observability — LangSmith

```python
import os
os.environ["LANGSMITH_API_KEY"] = "..."
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_PROJECT"] = "my-app"
```

Now every invoke is traced — see prompts, model calls, latencies, costs in the LangSmith UI. Critical for debugging agent behavior.

## Best Practices

- **Prefer LCEL over deprecated `LLMChain`, `SequentialChain`** — legacy patterns, breaking changes coming
- **Stream user-facing responses** — UX win
- **Structured output** for any data extraction — beats regex/json.loads on free text
- **Type hints + docstrings on tools** — model uses these as the function spec
- **LangSmith tracing in dev + prod** — without it, agent debugging is impossible
- For agents, **prefer LangGraph over `AgentExecutor`** — explicit state, easier to debug
- Pin LLM provider versions — model behavior drifts; pin `claude-opus-4-7` not "claude-latest"
- Cache embeddings — re-embedding the same docs is waste

## Common Pitfalls

- Building agents without observability → no way to debug why it loops/fails
- No structured output → fragile string parsing breaks on model behavior change
- Treating tools like REST endpoints (returning huge JSON) → model context bloat
- Not retrying on rate limits / timeouts → silent failures in prod
- Mixing sync + async in same chain → "RuntimeError: This event loop is already running"
- Forgetting `RunnableLambda` wrapper when piping a plain function — LCEL needs Runnables

## Cost Management

- **Cache LLM calls** at the prompt level (LangChain supports Redis cache)
- Use **smaller models** for simple steps (router, formatter), reserve Opus for hard reasoning
- Truncate context aggressively — chat history > 50 turns becomes wasteful
- Stream + show partial results → users abort sooner, fewer wasted completions
- Track token usage via callbacks; alert on outliers

## Resources

- LangChain Docs: https://python.langchain.com
- LangGraph Docs: https://langchain-ai.github.io/langgraph
- LangSmith: https://smith.langchain.com
- Templates: https://templates.langchain.com
- Cookbook: https://github.com/langchain-ai/langchain/tree/master/cookbook
