interface Workflow {
  
}

export function useWorkflows() {
  return useStorage<Workflow>('workflows')
}
