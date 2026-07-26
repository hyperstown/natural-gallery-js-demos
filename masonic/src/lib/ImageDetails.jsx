import { CalendarIcon, DownloadIcon, HouseIcon } from 'lucide-react'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * `post` is a gallery model, or null while nothing is open. `open` slides the
 * panel in; it stays mounted either way so the transition can run.
 */
export default function ImageDetails({ post = null, open = false }) {
  // Only picsum's "multiple authors" photos have more than one, hence the split.
  const artists = post?.artists ? String(post.artists).split(' & ') : []
  const copyright = [post?.copyright].flat().filter(Boolean)
  const characters = post?.characters ?? []
  const tags = post?.tags ?? []

  return (
    <aside
      className={open ? 'details-overlay' : 'details-overlay hidden-overlay'}
      aria-hidden={!open}
    >
      {post && (
        <div className="details">
          <p>
            <HouseIcon className="size-4" />
            <a className="anchor" href={post.link} target="_blank" rel="noreferrer">
              {post.board} - {post.id}
            </a>
          </p>

          {post.likedAt && (
            <p>
              <CalendarIcon className="size-4" />
              <span>Liked {dateFormat.format(new Date(post.likedAt))}</span>
            </p>
          )}

          {post.downloadLink && (
            <p>
              <DownloadIcon className="size-4" />
              <a className="anchor" href={post.downloadLink} target="_blank" rel="noreferrer">
                Download original
              </a>
              <span className="kind">
                ({post.enlargedWidth}×{post.enlargedHeight} shown)
              </span>
            </p>
          )}

          <div className="tags-list">
            {characters.map((character) => (
              <p key={character}>
                {character} <span className="kind">(character)</span>
              </p>
            ))}
            {artists.map((artist) => (
              <p key={artist}>
                {artist} <span className="kind">(artist)</span>
              </p>
            ))}
            {copyright.map((owner) => (
              <p key={owner}>
                {owner} <span className="kind">(copyright)</span>
              </p>
            ))}
          </div>

          {tags.length > 0 && (
            <>
              <hr />
              <div className="tags-list">
                {tags.map((tag) => (
                  <p key={tag}>{tag}</p>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
