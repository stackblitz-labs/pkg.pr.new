import { Feed } from 'feed'
import { joinURL } from 'ufo'
import { getRequestURL } from 'h3'
import type { Contributions } from '~~/types/index'

export default defineEventHandler(async (event) => {
  const domain = getRequestURL(event).origin
  const { user, prs } = await $fetch<Contributions>('/api/contributions')
  const feed = new Feed({
    title: `${user.name} is contributing...`,
    description: `Discover ${user.name}'s recent pull requests on GitHub`,
    id: domain,
    link: domain,
    language: 'en',
    image: joinURL(domain, 'favicon.png'),
    favicon: joinURL(domain, 'favicon.png'),
    copyright: `CC BY-NC-SA 4.0 2024 © ${user.name}`,
    feedLinks: {
      rss: `${domain}/rss.xml`,
    },
  })

  for (const pr of prs) {
    feed.addItem({
      link: pr.url,
      date: new Date(pr.created_at),
      title: pr.title,
      image: `https://github.com/${pr.repo.split('/')[0]}.png`,
      description: `<a href="${pr.url}">${pr.title}</a>`,
    })
  }

  appendHeader(event, 'Content-Type', 'application/xml')
  return feed.rss2()
})
