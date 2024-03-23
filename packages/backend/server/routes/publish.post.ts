import { WorkflowData } from "../types"

export default eventHandler(async (event) => {
  const key = getRequestHeader(event, 'sb-key')
  const {getItem, hasItem, removeItem} = useBucket()

  // if (!await hasItem(key)) {
  //   return new Response("", {status: 401})
  // }

  const workflowData = JSON.parse(await getItem(key)) as WorkflowData
  console.log(workflowData)
  console.log(readRawBody(event))

  // await removeItem(key)
})
