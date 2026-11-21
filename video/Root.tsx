import { Composition, registerRoot, type CalculateMetadataFunction } from 'remotion'
import type { CompositionInput, CoverStillInput } from '../src/utilities/tutorials/types.ts'
import { Cover } from './components/Cover.tsx'
import { COVER_SECONDS } from './lib/cover.ts'
import { FPS, SIZES, buildTimeline, toFrames } from './lib/timeline.ts'
import { Tutorial } from './Tutorial.tsx'

/** Mida i durada a partir de les dades: el servidor les passa com a inputProps. */
export const calculateMetadata: CalculateMetadataFunction<CompositionInput> = ({ props }) => {
  const size = SIZES[props.format]
  return {
    durationInFrames: Math.max(1, toFrames(buildTimeline(props).duration)),
    width: size.width,
    height: size.height,
    fps: FPS,
  }
}

const coverMetadata: CalculateMetadataFunction<CoverStillInput> = ({ props }) => {
  const size = SIZES[props.format]
  return { durationInFrames: toFrames(COVER_SECONDS), width: size.width, height: size.height, fps: FPS }
}

function CoverStill({ cover, seconds }: CoverStillInput) {
  return <Cover cover={cover} seconds={seconds} />
}

function Root() {
  return (
    <>
      <Composition
        id="Tutorial"
        component={Tutorial}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={60}
        defaultProps={{} as CompositionInput}
        calculateMetadata={calculateMetadata}
      />
      {/* Miniatura (portada) com a imatge fixa. */}
      <Composition
        id="Cover"
        component={CoverStill}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={toFrames(COVER_SECONDS)}
        defaultProps={{} as CoverStillInput}
        calculateMetadata={coverMetadata}
      />
    </>
  )
}

registerRoot(Root)
