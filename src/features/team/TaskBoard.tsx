import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskStatus } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Avatar } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { SubmitToClient } from '@/features/updates/SubmitToClient'
import type { WorkspaceData } from './ProjectWorkspace'

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

export function TaskBoard({ data, reload, setData }: { data: WorkspaceData; reload: () => Promise<void>; setData: (d: WorkspaceData) => void }) {
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [submitTask, setSubmitTask] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const toast = useToast()

  const move = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return
    // Optimistic update, then save.
    setData({ ...data, tasks: data.tasks.map((t) => (t.id === task.id ? { ...t, status } : t)) })
    const { error } = await supabase.from('tasks').update({ status }).eq('id', task.id)
    if (error) {
      toast(friendlyError(error), 'error')
      void reload()
    } else if (status === 'done') {
      toast('Task done. Want to tell the client? Use "Submit to client" on the card.', 'info')
    }
  }

  const memberName = (id: string | null) => data.members.find((m) => m.id === id)
  const stageName = (id: string | null) => data.stages.find((s) => s.id === id)?.name

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-secondary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Add task
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col, ci) => {
          const tasks = data.tasks.filter((t) => t.status === col.id)
          return (
            <section
              key={col.id}
              aria-labelledby={`col-${col.id}`}
              className="card-surface flex min-h-48 flex-col p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const t = data.tasks.find((x) => x.id === dragId)
                if (t) void move(t, col.id)
                setDragId(null)
              }}
            >
              <h3 id={`col-${col.id}`} className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                {col.label}
                <span className="text-xs font-normal text-muted">{tasks.length}</span>
              </h3>
              <ul className="flex flex-1 flex-col gap-2">
                {tasks.map((t) => {
                  const who = memberName(t.assignee_id)
                  return (
                    <li key={t.id} draggable onDragStart={() => setDragId(t.id)} className="card cursor-grab p-3 active:cursor-grabbing">
                      <button type="button" className="w-full text-left text-sm font-medium hover:text-accent" onClick={() => setEditing(t)}>
                        {t.title}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {stageName(t.stage_id) && <span className="badge">{stageName(t.stage_id)}</span>}
                        {t.due_date && <span>Due {formatDate(t.due_date)}</span>}
                        {who && (
                          <span className="ml-auto flex items-center gap-1.5">
                            <Avatar name={who.full_name ?? who.email} url={who.avatar_url} size={20} />
                            <span className="sr-only">Assigned to {who.full_name ?? who.email}</span>
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
                        <button
                          type="button"
                          className="btn-ghost btn-sm h-7 px-1.5"
                          disabled={ci === 0}
                          onClick={() => move(t, COLUMNS[ci - 1].id)}
                          aria-label={`Move "${t.title}" to ${COLUMNS[ci - 1]?.label ?? ''}`}
                        >
                          <Icon name="arrowLeft" size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm h-7 px-1.5"
                          disabled={ci === COLUMNS.length - 1}
                          onClick={() => move(t, COLUMNS[ci + 1].id)}
                          aria-label={`Move "${t.title}" to ${COLUMNS[ci + 1]?.label ?? ''}`}
                        >
                          <Icon name="arrowRight" size={14} />
                        </button>
                        <button type="button" className="btn-ghost btn-sm ml-auto h-7 px-2" onClick={() => setSubmitTask(t.id)}>
                          <Icon name="send" size={14} /> Submit to client
                        </button>
                      </div>
                    </li>
                  )
                })}
                {tasks.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted">Nothing here.</li>}
              </ul>
            </section>
          )
        })}
      </div>

      <TaskEditor task={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />
      <SubmitToClient
        open={submitTask !== null}
        onClose={() => setSubmitTask(null)}
        project={data.project}
        tasks={data.tasks}
        initialTaskId={submitTask}
        onSubmitted={reload}
      />
    </div>
  )
}

function TaskEditor({ task, data, onClose, onSaved }: { task: Task | 'new' | null; data: WorkspaceData; onClose: () => void; onSaved: () => Promise<void> }) {
  const isNew = task === 'new'
  const t = task && task !== 'new' ? task : null
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', stage_id: '', status: 'todo' as TaskStatus, due_date: '' })
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const key = task === null ? null : isNew ? 'new' : t!.id
  if (key !== loadedFor) {
    setLoadedFor(key)
    setError(null)
    setForm({
      title: t?.title ?? '',
      description: t?.description ?? '',
      assignee_id: t?.assignee_id ?? '',
      stage_id: t?.stage_id ?? data.stages.find((s) => s.status === 'active')?.id ?? '',
      status: t?.status ?? 'todo',
      due_date: t?.due_date ?? '',
    })
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!form.title.trim()) return setError('Please add a title.')
    setBusy(true)
    const row = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assignee_id: form.assignee_id || null,
      stage_id: form.stage_id || null,
      status: form.status,
      due_date: form.due_date || null,
    }
    const { error: err } = isNew
      ? await supabase.from('tasks').insert({ ...row, project_id: data.project.id, position: data.tasks.length + 1 })
      : await supabase.from('tasks').update(row).eq('id', t!.id)
    setBusy(false)
    if (err) return setError(friendlyError(err))
    toast(isNew ? 'Task added.' : 'Task saved.')
    onClose()
    void onSaved()
  }

  const remove = async () => {
    if (!t || !window.confirm('Delete this task?')) return
    const { error: err } = await supabase.from('tasks').delete().eq('id', t.id)
    if (err) return setError(friendlyError(err))
    onClose()
    void onSaved()
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal
      open={task !== null}
      onClose={onClose}
      title={isNew ? 'New task' : 'Edit task'}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn-ghost mr-auto text-danger" onClick={remove}>
              Delete
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={save}>
        <div>
          <label htmlFor="task-title" className="label">
            Title
          </label>
          <input id="task-title" className="field" value={form.title} maxLength={200} onChange={set('title')} />
        </div>
        <div>
          <label htmlFor="task-desc" className="label">
            Description
          </label>
          <textarea id="task-desc" className="field min-h-24" value={form.description} maxLength={5000} onChange={set('description')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-assignee" className="label">
              Assignee
            </label>
            <select id="task-assignee" className="field" value={form.assignee_id} onChange={set('assignee_id')}>
              <option value="">Nobody yet</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? m.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-stage" className="label">
              Stage
            </label>
            <select id="task-stage" className="field" value={form.stage_id} onChange={set('stage_id')}>
              <option value="">No stage</option>
              {data.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-status" className="label">
              Status
            </label>
            <select id="task-status" className="field" value={form.status} onChange={set('status')}>
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-due" className="label">
              Due date
            </label>
            <input id="task-due" type="date" className="field" value={form.due_date} onChange={set('due_date')} />
          </div>
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="sr-only">
          Save
        </button>
      </form>
    </Modal>
  )
}
