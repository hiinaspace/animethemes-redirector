import { Hono } from 'hono'

const app = new Hono()

const VIDEO_BASE_URL = (process.env.VIDEO_BASE_URL ?? 'http://localhost:8080/video').replace(/\/$/, '')
const GRAPHQL_URL = 'https://graphql.animethemes.moe/'
const THEME_SLUG_RE = /^(OP|ED)(\d+)?(v(\d+))?(?:-(.+))?$/i

const QUERY = `
  query($anime: String!, $theme: String!) {
    anime(slug: $anime) {
      animethemes(slug: $theme) {
        animethemeentries {
          videos {
            nodes { path tags }
          }
        }
      }
    }
  }
`

interface Video {
  path: string
  tags: string
}

interface Entry {
  videos: { nodes: Video[] }
}

interface AnimeTheme {
  animethemeentries: Entry[]
}

interface GraphQLResponse {
  data?: {
    anime?: {
      animethemes?: AnimeTheme[]
    }
  }
  errors?: { message: string }[]
}

app.get('/anime/:animeSlug/:themeEntry', async (c) => {
  const { animeSlug, themeEntry } = c.req.param()

  const match = THEME_SLUG_RE.exec(themeEntry)
  if (!match) return c.text('Invalid theme slug format', 400)

  const [, type, seq, , , tags] = match
  const themeSlug = `${type.toUpperCase()}${seq ?? ''}`
  const targetTags = tags ?? ''

  let result: GraphQLResponse
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'animethemes-redirector/1.0 (https://github.com/s/animethemes-redirector)',
      },
      body: JSON.stringify({ query: QUERY, variables: { anime: animeSlug, theme: themeSlug } }),
    })
    result = await res.json() as GraphQLResponse
  } catch (e) {
    return c.text('Failed to reach AnimeThemes API', 502)
  }

  if (result.errors?.length) {
    const msg = result.errors[0].message
    // Singular queries (anime by slug) return a GraphQL error when not found
    if (msg.includes('No query results')) return c.text('Anime or theme not found', 404)
    return c.text(`AnimeThemes API error: ${msg}`, 502)
  }

  const themes = result.data?.anime?.animethemes ?? []
  if (!themes.length) return c.text('Anime or theme not found', 404)

  // Flatten all videos across all entries for this theme
  const videos = themes.flatMap(t => t.animethemeentries.flatMap(e => e.videos.nodes))

  const video = targetTags
    ? videos.find(v => v.tags === targetTags)
    : videos[0]

  if (!video) return c.text('No matching video found', 404)

  return c.redirect(`${VIDEO_BASE_URL}/${video.path}`, 301)
})

export default app
