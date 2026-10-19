# Set up pstack

In this page you confirm the install, point pstack at your models, and run your first task. Setup is one skill plus a short conversation.

## Confirm the install

pstack is not a Cursor plugin here. It is a set of skills and subagents already unpacked into your opencode config:

```text
~/.config/opencode/skills/               the pstack skills, one directory each
~/.config/opencode/agent/                the subagents they delegate to
~/.config/opencode/pstack-automations/   the automation definitions
```

Open a chat in the repo you want to work in and pstack is available.

## Pick your models

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../../setup-pstack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.config/opencode/pstack-models.json`, a small JSON file of role-to-model mappings that every pstack skill reads.

The role keys stay the ones upstream uses. Only the values differ, because this machine's catalog is a single provider family. `opencode models` returns `opencode/*` and nothing else: `opencode/big-pickle`, `opencode/fledge-alpha-free`, `opencode/ling-3.0-flash-fin-free`, `opencode/longcat-2.5-preview-free`, `opencode/mimo-v2.6-flash-free`, `opencode/muse-spark-1.3-contributor-free`, `opencode/nemotron-3-ultra-free`, `opencode/nemotron-3.5-lightning-free`, `opencode/space-bunny-free`. Upstream's multi-vendor defaults don't exist here, so most roles land on `inherit-parent`. Pick a concrete `opencode/*` slug when you want a role pinned, and authenticate another provider family in opencode if you want the panel diversity upstream was designed around; `/setup-pstack` will offer those on the next run.

You only override what you care about. A role absent from the JSON keeps the skill's default. To restore a default, delete that role's key. A rerun of `/setup-pstack` keeps any role whose model differs from the default.

You might be wondering what happens if you use Auto. Set a role to `inherit-parent` or `auto` and pstack omits the subagent `model` field, so the subagent inherits your parent chat model. Both values mean the same thing, and neither is a model slug. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Worth knowing what that costs you: with one provider family, a panel of N runners is N samples of one model's blind spot, not N independent opinions. Setup also configures `swarm workers`, the default model for every `/swarm` worker unless a race names a model for each arm.

## Accept the verification offer, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../../create-verification-skill/SKILL.md).

Say yes and it writes `.opencode/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers when it earns its place.


After setup, start a new chat. The model file applies to new sessions.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch `todo.md` at the repository root. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. `/poteto-mode` runs as the `poteto-mode` primary agent, so it stays in context on every turn of the session until you switch agents or opt out by saying so. Model choices from `/setup-pstack` only reach a new session, so start one after changing them.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).