import { z } from 'zod'

const querySchema = z.object({
  text: z.string(),
})

export default defineEventHandler(async (event) => {
  const r2Binding = useBinding(event)
  const request = toWebRequest(event)
  const signal = request.signal

  try {
    const query = await getValidatedQuery(event, data =>
      querySchema.parse(data))

    if (!query.text) {
      return { nodes: [] }
    }

    const searchText = query.text.toLowerCase()

    // Internal pagination: iterate until uniqueNodes is filled or no more objects
    let cursor: string | undefined
    const seen = new Set<string>()
    const uniqueNodes = []
    const maxNodes = 10
    let keepGoing = true

    while (uniqueNodes.length < maxNodes && keepGoing && !signal.aborted) {
      const listResult = await r2Binding.list({
        prefix: usePackagesBucket.base,
        limit: 1000,
        cursor,
      })
      const { objects, truncated } = listResult
      cursor = truncated ? listResult.cursor : undefined

      const parsedObjects = objects.map(obj => parseKey(obj.key))
      const filtered = parsedObjects.filter((obj) => {
        const orgRepo = `${obj.org}/${obj.repo}`.toLowerCase()
        return (
          obj.org.toLowerCase().includes(searchText)
          || obj.repo.toLowerCase().includes(searchText)
          || orgRepo.includes(searchText)
        )
      })

      for (const obj of filtered) {
        const key = `${obj.org}/${obj.repo}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueNodes.push({
            name: obj.repo,
            owner: {
              login: obj.org,
              avatarUrl: `https://github.com/${obj.org}.png`,
            },
          })
          if (uniqueNodes.length >= maxNodes)
            break
        }
      }

      if (!truncated || uniqueNodes.length >= maxNodes) {
        keepGoing = false
      }
    }

    return {
      nodes: uniqueNodes,
    }
  }
  catch (error) {
    console.error('Error in repository search:', error)
    return {
      nodes: [],
      error: true,
      message: (error as Error).message,
    }
  }
})

function parseKey(key: string) {
  const parts = key.split(':')
  return {
    org: parts[2],
    repo: parts[3],
    hash: parts[4],
    suffix: parts[5],
    key,
  }
}
