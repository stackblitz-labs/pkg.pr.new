type Params = {
  uuid: string
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const stream = await getItemStream(
    event,
    useTemplatesBucket.base,
    params.uuid,
  );

  return stream
})
