import * as React from 'react'
import {
  Popover,
  PopoverAnchorPosition,
  PopoverDecoration,
} from '../lib/popover'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Button } from '../lib/button'
import classNames from 'classnames'
import { CommittedFileChange, AppFileStatusKind } from '../../models/status'

interface IStashedFilesFilterState {
  readonly filterText: string
  readonly filterNewFiles: boolean
  readonly filterModifiedFiles: boolean
  readonly filterDeletedFiles: boolean
}

interface IStashedFilesFilterOptionsProps {
  readonly filterState: IStashedFilesFilterState
  readonly files: ReadonlyArray<CommittedFileChange>
  readonly onFilterNewFiles: () => void
  readonly onFilterModifiedFiles: () => void
  readonly onFilterDeletedFiles: () => void
  readonly onClearAllFilters: () => void
}

interface IStashedFilesFilterOptionsState {
  readonly isFilterOptionsOpen: boolean
}

export class StashedFilesFilterOptions extends React.Component<
  IStashedFilesFilterOptionsProps,
  IStashedFilesFilterOptionsState
> {
  private filterOptionsButtonRef: HTMLButtonElement | null = null

  public constructor(props: IStashedFilesFilterOptionsProps) {
    super(props)

    this.state = {
      isFilterOptionsOpen: false,
    }
  }

  private closeFilterOptions = () => {
    this.setState({ isFilterOptionsOpen: false })
  }

  private onFilterNewFiles = () => {
    this.props.onFilterNewFiles()
  }

  private onFilterModifiedFiles = () => {
    this.props.onFilterModifiedFiles()
  }

  private onFilterDeletedFiles = () => {
    this.props.onFilterDeletedFiles()
  }

  private onClearAllFilters = () => {
    this.props.onClearAllFilters()
    this.closeFilterOptions()
  }

  private toggleFilterOptions = () => {
    this.setState(prevState => ({
      isFilterOptionsOpen: !prevState.isFilterOptionsOpen,
    }))
  }

  private getFilterCounts = () => {
    const counts = {
      newFilesCount: 0,
      modifiedFilesCount: 0,
      deletedFilesCount: 0,
    }

    this.props.files.forEach(file => {
      if (file.status.kind === AppFileStatusKind.New) {
        counts.newFilesCount++
      } else if (file.status.kind === AppFileStatusKind.Modified) {
        counts.modifiedFilesCount++
      } else if (file.status.kind === AppFileStatusKind.Deleted) {
        counts.deletedFilesCount++
      }
    })

    return counts
  }

  private hasActiveFilters = (): boolean => {
    const { filterState } = this.props
    return (
      filterState.filterNewFiles ||
      filterState.filterModifiedFiles ||
      filterState.filterDeletedFiles
    )
  }

  private onFilterOptionsButtonRef = (ref: HTMLButtonElement | null) => {
    this.filterOptionsButtonRef = ref
  }

  private renderFilterPopover = () => {
    if (!this.state.isFilterOptionsOpen || !this.filterOptionsButtonRef) {
      return null
    }

    const counts = this.getFilterCounts()
    const { filterState } = this.props

    return (
      <Popover
        anchor={this.filterOptionsButtonRef}
        anchorPosition={PopoverAnchorPosition.BottomLeft}
        decoration={PopoverDecoration.Balloon}
        onClickOutside={this.closeFilterOptions}
        className="filter-popover"
      >
        <div className="popover-content">
          <div className="filter-popover-header">
            <h3>Filter by status</h3>
            <button
              className="close"
              onClick={this.closeFilterOptions}
              aria-label="Close"
            >
              <Octicon symbol={octicons.x} />
            </button>
          </div>

          <div className="filter-options">
            <Checkbox
              label={`New (${counts.newFilesCount})`}
              value={filterState.filterNewFiles ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onFilterNewFiles}
            />
            <Checkbox
              label={`Modified (${counts.modifiedFilesCount})`}
              value={filterState.filterModifiedFiles ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onFilterModifiedFiles}
            />
            <Checkbox
              label={`Deleted (${counts.deletedFilesCount})`}
              value={filterState.filterDeletedFiles ? CheckboxValue.On : CheckboxValue.Off}
              onChange={this.onFilterDeletedFiles}
            />
          </div>

          <div className="filter-options-footer">
            <Button onClick={this.onClearAllFilters} disabled={!this.hasActiveFilters()}>
              Clear filters
            </Button>
          </div>
        </div>
      </Popover>
    )
  }

  public render() {
    const hasFilters = this.hasActiveFilters()

    const buttonClassName = classNames('filter-button', {
      active: hasFilters,
    })

    return (
      <>
        <button
          ref={this.onFilterOptionsButtonRef}
          className={buttonClassName}
          onClick={this.toggleFilterOptions}
          aria-label="Filter options"
        >
          <span>Filter</span>
          <Octicon symbol={octicons.chevronDown} />
          {hasFilters && (
            <span className="active-badge">
              <span className="badge-bg">
                <span className="badge" />
              </span>
            </span>
          )}
        </button>
        {this.renderFilterPopover()}
      </>
    )
  }
}
