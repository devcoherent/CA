import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { AccessKey, ProjectTemplate, TemplateItem } from '@/lib/types'
import { ACCESS_STEP_CONTENT } from '@/content/accessSteps'
import { friendlyError } from '@/lib/errors'
import { Card, ErrorBox, LoadingList, PageHeader, Tabs } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function TemplatesPage() {
  const { data, error, loading, reload } = useAsync(async () => {
    const [templates, items] = await Promise.all([
      supabase.from('project_templates').select('*').order('name'),
      supabase.from('template_items').select('*').order('position'),
    ])
    return { templates: unwrap(templates) as ProjectTemplate[], items: unwrap(items) as TemplateItem[] }
  }, [])
  const [selected, setSelected] = useState<string>('')

  if (error) return <ErrorBox message={friendlyError(error)} onRetry={reload} />
  if (loading || !data) return <LoadingList rows={3} className="h-24" />
  const current = data.templates.find((t) => t.id === selected) ?? data.templates[0]
  if (!current) return null
  const items = data.items.filter((i) => i.template_id === current.id)

  return (
    <div>
      <PageHeader title="Project templates" subtitle="New projects copy these stages, tasks and access steps. Changes do not affect existing projects." />
      <Tabs label="Templates" value={current.id} onChange={setSelected} tabs={data.templates.map((t) => ({ id: t.id, label: t.name }))} />
      <div className="grid gap-6 lg:grid-cols-3">
        <ItemList title="Stages" kind="stage" template={current} items={items} stages={items} reload={reload} />
        <ItemList title="Tasks" kind="task" template={current} items={items} stages={items} reload={reload} />
        <ItemList title="Access steps" kind="access_step" template={current} items={items} stages={items} reload={reload} />
      </div>
    </div>
  )
}

function ItemList({
  title,
  kind,
  template,
  items,
  stages,
  reload,
}: {
  title: string
  kind: TemplateItem['kind']
  template: ProjectTemplate
  items: TemplateItem[]
  stages: TemplateItem[]
  reload: () => Promise<void>
}) {
  const toast = useToast()
  const list = items.filter((i) => i.kind === kind)
  const stageNames = stages.filter((s) => s.kind === 'stage').map((s) => s.name)
  const [name, setName] = useState('')
  const [stageName, setStageName] = useState('')
  const [accessKey, setAccessKey] = useState<AccessKey>('webflow')
  const usedKeys = list.map((i) => i.access_key)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const row = {
      template_id: template.id,
      kind,
      position: (list.at(-1)?.position ?? 0) + 1,
      name: kind === 'access_step' ? ACCESS_STEP_CONTENT[accessKey].title : name.trim(),
      stage_name: kind === 'task' ? stageName || stageNames[0] || null : null,
      access_key: kind === 'access_step' ? accessKey : null,
    }
    if (!row.name) return
    const { error } = await supabase.from('template_items').insert(row)
    if (error) return toast(friendlyError(error), 'error')
    setName('')
    void reload()
  }

  const rename = async (item: TemplateItem, value: string) => {
    if (!value.trim() || value === item.name) return
    const { error } = await supabase.from('template_items').update({ name: value.trim() }).eq('id', item.id)
    if (error) toast(friendlyError(error), 'error')
    else void reload()
  }

  const remove = async (item: TemplateItem) => {
    const { error } = await supabase.from('template_items').delete().eq('id', item.id)
    if (error) toast(friendlyError(error), 'error')
    else void reload()
  }

  return (
    <Card>
      <h2 className="mb-4 font-semibold">{title}</h2>
      <ul className="space-y-2">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            {kind === 'access_step' ? (
              <span className="flex-1 text-sm">{i.name}</span>
            ) : (
              <>
                <label htmlFor={`ti-${i.id}`} className="sr-only">
                  {title} name
                </label>
                <input id={`ti-${i.id}`} className="field py-1.5" defaultValue={i.name} onBlur={(e) => rename(i, e.target.value)} />
              </>
            )}
            {kind === 'task' && i.stage_name && <span className="hidden shrink-0 text-xs text-muted xl:inline">{i.stage_name}</span>}
            <button type="button" className="shrink-0 text-xs text-muted hover:text-danger" onClick={() => remove(i)} aria-label={`Remove ${i.name}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 space-y-2 border-t border-border pt-4">
        {kind === 'access_step' ? (
          <>
            <label htmlFor={`add-${kind}`} className="sr-only">
              Access step to add
            </label>
            <select id={`add-${kind}`} className="field" value={accessKey} onChange={(e) => setAccessKey(e.target.value as AccessKey)}>
              {(Object.keys(ACCESS_STEP_CONTENT) as AccessKey[])
                .filter((k) => !usedKeys.includes(k))
                .map((k) => (
                  <option key={k} value={k}>
                    {ACCESS_STEP_CONTENT[k].title}
                  </option>
                ))}
            </select>
          </>
        ) : (
          <>
            <label htmlFor={`add-${kind}`} className="sr-only">
              New {title.toLowerCase()} name
            </label>
            <input id={`add-${kind}`} className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Add ${kind === 'stage' ? 'a stage' : 'a task'}`} />
          </>
        )}
        {kind === 'task' && stageNames.length > 0 && (
          <>
            <label htmlFor="add-task-stage" className="sr-only">
              Stage for the new task
            </label>
            <select id="add-task-stage" className="field" value={stageName} onChange={(e) => setStageName(e.target.value)}>
              {stageNames.map((s) => (
                <option key={s} value={s}>
                  In stage: {s}
                </option>
              ))}
            </select>
          </>
        )}
        <button type="submit" className="btn-secondary btn-sm" disabled={kind === 'access_step' && usedKeys.length >= 6}>
          Add
        </button>
      </form>
    </Card>
  )
}
