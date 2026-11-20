import { Composition, registerRoot, type CalculateMetadataFunction } from 'remotion'
import type { CompositionInput } from '../src/utilities/tutorials/types.ts'
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

function Root() {
  return (
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
  )
}

registerRoot(Root)
