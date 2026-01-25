import * as React from 'react'
import { Repository } from '../../models/repository'
import { CommittedFileChange } from '../../models/status'
import { DiffHeader } from '../diff/diff-header'
import { SeamlessDiffSwitcher } from '../diff/seamless-diff-switcher'
import { IDiff, ImageDiffType } from '../../models/diff'

interface IStashDiffPanelProps {
  readonly repository: Repository
  readonly file: CommittedFileChange | null
  readonly diff: IDiff | null
  readonly imageDiffType: ImageDiffType
  readonly showSideBySideDiff: boolean
  readonly hideWhitespaceInDiff: boolean
  readonly onShowSideBySideDiffChanged: (showSideBySideDiff: boolean) => void
  readonly onChangeImageDiffType: (type: ImageDiffType) => void
  readonly onOpenBinaryFile: (fullPath: string) => void
  readonly onOpenSubmodule: (fullPath: string) => void
  readonly onHideWhitespaceInDiffChanged: (
    hideWhitespace: boolean
  ) => Promise<void>
  readonly onDiffOptionsOpened: () => void
}

export class StashDiffPanel extends React.Component<IStashDiffPanelProps> {
  public render() {
    const { file, diff } = this.props

    if (file === null) {
      return (
        <div className="panel blankslate" id="diff">
          No file selected
        </div>
      )
    }

    return (
      <div className="diff-container">
        <DiffHeader
          path={file.path}
          status={file.status}
          diff={diff}
          showSideBySideDiff={this.props.showSideBySideDiff}
          onShowSideBySideDiffChanged={this.onShowSideBySideDiffChanged}
          hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
          onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
          onDiffOptionsOpened={this.props.onDiffOptionsOpened}
        />

        <SeamlessDiffSwitcher
          repository={this.props.repository}
          imageDiffType={this.props.imageDiffType}
          file={file}
          readOnly={true}
          diff={diff}
          hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
          showSideBySideDiff={this.props.showSideBySideDiff}
          showDiffCheckMarks={false}
          onOpenBinaryFile={this.props.onOpenBinaryFile}
          onOpenSubmodule={this.props.onOpenSubmodule}
          onChangeImageDiffType={this.props.onChangeImageDiffType}
          onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
        />
      </div>
    )
  }

  private onShowSideBySideDiffChanged = (showSideBySideDiff: boolean) => {
    this.props.onShowSideBySideDiffChanged(showSideBySideDiff)
  }

  private onHideWhitespaceInDiffChanged = (hideWhitespaceInDiff: boolean) => {
    return this.props.onHideWhitespaceInDiffChanged(hideWhitespaceInDiff)
  }
}
