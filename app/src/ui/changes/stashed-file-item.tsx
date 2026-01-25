import * as React from 'react'
import { CommittedFileChange } from '../../models/status'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { PathLabel } from '../lib/path-label'
import { Octicon, iconForStatus } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IStashedFileItemProps {
  readonly file: CommittedFileChange
  readonly include: boolean
  readonly onIncludeChanged: (
    file: CommittedFileChange,
    include: boolean
  ) => void
  readonly availableWidth: number
  readonly focused: boolean
  readonly inWorkingDirectory: boolean
}

export class StashedFileItem extends React.Component<IStashedFileItemProps> {
  private handleCheckboxChange = (event: React.FormEvent<HTMLInputElement>) => {
    const include = event.currentTarget.checked
    this.props.onIncludeChanged(this.props.file, include)
  }

  public render() {
    const { file, include, availableWidth, focused, inWorkingDirectory } =
      this.props

    const checkboxValue = include ? CheckboxValue.On : CheckboxValue.Off
    const status = file.status

    // Calculate available width for path (subtract checkbox + icons + padding)
    const availablePathWidth = availableWidth - 150

    const className = `file ${focused ? 'focused' : ''}`

    return (
      <div className={className}>
        <Checkbox
          tabIndex={-1}
          value={checkboxValue}
          onChange={this.handleCheckboxChange}
          disabled={false}
        />

        <PathLabel
          path={file.path}
          status={status}
          availableWidth={availablePathWidth}
        />

        {/* Pencil icon - file also exists in working directory */}
        {inWorkingDirectory && (
          <Octicon
            symbol={octicons.pencil}
            className="file-indicator-icon"
            title="File also exists in working directory"
          />
        )}

        {/* File status icon */}
        <Octicon
          symbol={iconForStatus(status)}
          className={`status status-${status.kind.toLowerCase()}`}
        />
      </div>
    )
  }
}
