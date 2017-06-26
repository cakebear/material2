/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Component, Directive, Input, Output,
  OnDestroy, AfterViewInit, ElementRef, Injectable, Optional} from '@angular/core';
import {Scrollable} from '../core/overlay/scroll/scrollable';


/**
 * 'cdkStickyRegion' is a region contains one sticky header and other
 * contents that user wants to put under the sticky-header. There only can
 * be one sticky-header in one 'cdkStickyRegion'.
 * If a user does not define a 'cdkStickyRegion' for a sticky-header, the direct
 * parent node of the sticky-header will be set as the 'cdkStickyRegion'.
 */
@Directive({
  selector: '[cdkStickyRegion]',
})
export class CdkStickyRegion {
  constructor(private _element: ElementRef) { }

  getElementRef(): ElementRef {
    return this._element;
  }
}


/**
 * The 'cdkStickyHeader' is the header which user wants to be stuck at top of the
 * scrollable container. The main logic is in the 'sticker()' function.
 */
const STICK_START_CLASS = 'stick-start';
const STICK_END_CLASS = 'sticky-end';
@Directive({
  selector: '[cdkStickyHeader]',
})
export class CdkStickyHeader implements OnDestroy, AfterViewInit {

  /**
   * Set the sticky-header's z-index as 10 in default. Make it as an input
   * variable to make user be able to customize the zIndex when
   * the sticky-header's zIndex is not the largest in current page.
   * Because if the sticky-header's zIndex is not the largest in current page,
   * it may be sheltered by other element when being stick.
   */
  @Input('cdkStickyHeaderZIndex') zIndex: number = 10;
  @Input('cdkStickyParentRegion') parentRegion: HTMLElement;
  @Input('cdkStickyScrollableRegion') scrollableRegion: HTMLElement;

  private _onScrollBind: EventListener = this.onScroll.bind(this);
  private _onResizeBind: EventListener = this.onResize.bind(this);
  private _onTouchMoveBind: EventListener = this.onTouchMove.bind(this);
  public isStuck: boolean = false;

  // the element with the 'cdkStickyHeader' tag
  public element: HTMLElement;

  // the upper container element with the 'cdkStickyRegion' tag
  public stickyParent: HTMLElement | null;
  public upperScrollableContainer: HTMLElement;

  /**
   * the original css of the sticky element, used to reset the sticky element
   * when it is being unstuck
   */
  public originalCss: any;

  private _containerStart: number;
  private _scrollFinish: number;

  private _scrollingWidth: number;

  constructor(private _element: ElementRef,
              public scrollable: Scrollable,
              @Optional() public parentReg: CdkStickyRegion) {
    this.element = _element.nativeElement;
    this.upperScrollableContainer = scrollable.getElementRef().nativeElement;
    this.scrollableRegion = scrollable.getElementRef().nativeElement;
    if (parentReg != null) {
      this.parentRegion = parentReg.getElementRef().nativeElement;
    }
  }

  ngAfterViewInit(): void {

    if (this.parentRegion != null) {
      this.stickyParent = this.parentRegion;
    }else {
      this.stickyParent = this.element.parentElement;
    }

    this.originalCss = {
      zIndex: this.getCssValue(this.element, 'zIndex'),
      position: this.getCssValue(this.element, 'position'),
      top: this.getCssValue(this.element, 'top'),
      right: this.getCssValue(this.element, 'right'),
      left: this.getCssValue(this.element, 'left'),
      bottom: this.getCssValue(this.element, 'bottom'),
      width: this.getCssValue(this.element, 'width'),
    };

    this.attach();

    this.defineRestrictionsAndStick();
  }

  ngOnDestroy(): void {
    this.upperScrollableContainer.removeEventListener('scroll', this._onScrollBind);
    this.upperScrollableContainer.removeEventListener('resize', this._onResizeBind);
    this.upperScrollableContainer.removeEventListener('touchmove', this._onTouchMoveBind);
  }

  attach() {
    this.upperScrollableContainer.addEventListener('scroll', this._onScrollBind, false);
    this.upperScrollableContainer.addEventListener('resize', this._onResizeBind, false);

    // Have to add a 'onTouchMove' listener to make sticky header work on mobile phones
    this.upperScrollableContainer.addEventListener('touchmove', this._onTouchMoveBind, false);
  }

  onScroll(): void {
    this.defineRestrictionsAndStick();
  }

  onTouchMove(): void {
    this.defineRestrictionsAndStick();
  }

  onResize(): void {
    this.defineRestrictionsAndStick();
    // If there's already a header being stick when the page is
    // resized. The CSS style of the cdkStickyHeader element may be not fit
    // the resized window. So we need to unstuck it then re-stick it.
    // unstuck() can set 'isStuck' to FALSE. Then stickElement() can work.
    if (this.isStuck) {
      this.unstuckElement();
      this.stickElement();
    }
  }

  /**
   * define the restrictions of the sticky header(including stickyWidth,
   * when to start, when to finish)
   */
  defineRestrictions(): void {
    if(this.stickyParent == null) {
      return;
    }
    let containerTop: any = this.stickyParent.getBoundingClientRect();
    let elemHeight: number = this.element.offsetHeight;
    let containerHeight: number = this.getCssNumber(this.stickyParent, 'height');
    this._containerStart = containerTop.top;

    // the padding of the element being sticked
    let elementPadding: any = this.getCssValue(this.element, 'padding');

    let paddingNumber: any = Number(elementPadding.slice(0, -2));
    this._scrollingWidth = this.upperScrollableContainer.clientWidth -
      paddingNumber - paddingNumber;

    this._scrollFinish = this._containerStart + (containerHeight - elemHeight);
  }

  /**
   * Reset element to its original CSS
   */
  resetElement(): void {
    this.element.classList.remove(STICK_START_CLASS);
    Object.assign(this.element.style, this.originalCss);
  }

  /**
   * Stuck element, make the element stick to the top of the scrollable container.
   */
  stickElement(): void {
    this.isStuck = true;

    this.element.classList.remove(STICK_END_CLASS);
    this.element.classList.add(STICK_START_CLASS);

    /**
     * Have to add the translate3d function for the sticky element's css style.
     * Because iPhone and iPad's browser is using its owning rendering engine. And
     * even if you are using Chrome on an iPhone, you are just using Safari with
     * a Chrome skin around it.
     *
     * Safari on iPad and Safari on iPhone do not have resizable windows.
     * In Safari on iPhone and iPad, the window size is set to the size of
     * the screen (minus Safari user interface controls), and cannot be changed
     * by the user. To move around a webpage, the user changes the zoom level and position
     * of the viewport as they double tap or pinch to zoom in or out, or by touching
     * and dragging to pan the page. As a user changes the zoom level and position of the
     * viewport they are doing so within a viewable content area of fixed size
     * (that is, the window). This means that webpage elements that have their position
     * "fixed" to the viewport can end up outside the viewable content area, offscreen.
     *
     * So the 'position: fixed' does not work on iPhone and iPad. To make it work,
     * 'translate3d(0,0,0)' needs to be used to force Safari re-rendering the sticky element.
     **/
    this.element.style.transform = 'translate3d(0,0,0)';

    let stuckRight: any = this.upperScrollableContainer.getBoundingClientRect().right;

    let stickyCss:any = {
      zIndex: this.zIndex,
      position: 'fixed',
      top: this.upperScrollableContainer.offsetTop + 'px',
      right: stuckRight + 'px',
      left: this.upperScrollableContainer.offsetLeft + 'px',
      bottom: 'auto',
      width: this._scrollingWidth + 'px',
    };
    Object.assign(this.element.style, stickyCss);
  }

  /**
   * Unstuck element: When an element reaches the bottom of its cdkStickyRegion,
   * It should be unstuck. And its position will be set as 'relative', its bottom
   * will be set as '0'. So it will be stick at the bottom of its cdkStickyRegion and
   * will be scrolled up with its cdkStickyRegion element. In this way, the sticky header
   * can be changed smoothly when two sticky header meet and the later one need to replace
   * the former one.
   */
  unstuckElement(): void {
    this.isStuck = false;

    if(this.stickyParent == null) {
      return;
    }

    this.element.classList.add(STICK_END_CLASS);
    this.stickyParent.style.position = 'relative';
    let unstuckCss: any = {
      position: 'absolute',
      top: 'auto',
      right: '0',
      left: 'auto',
      bottom: '0',
      width: this.originalCss.width,
    };
    Object.assign(this.element.style, unstuckCss);
  }


  /**
   * 'sticker()' function contains the main logic of sticky-header. It decides when
   * a header should be stick and when should it be unstuck. It will first get
   * the offsetTop of the upper scrollable container. And then get the Start and End
   * of the sticky-header's stickyRegion.
   * The header will be stick if 'stickyRegion Start < container offsetTop < stickyRegion End'.
   * And when 'stickyRegion End < container offsetTop', the header will be unstuck. It will be
   * stick to the bottom of its stickyRegion container and being scrolled up with its stickyRegion
   * container.
   * When 'stickyRegion Start > container offsetTop', which means the header come back to the
   * middle of the scrollable container, the header will be reset to its
   * original CSS.
   * A flag, isStuck. is used in this function. When a header is stick, isStuck = true.
   * And when the 'isStuck' flag is TRUE, the sticky-header will not be repaint, which
   * decreases the times on repainting sticky-header.
   */
  sticker(): void {
    let currentPosition: number = this.upperScrollableContainer.offsetTop;

    // unstuck when the element is scrolled out of the sticky region
    if (this.isStuck &&
      (currentPosition < this._containerStart || currentPosition > this._scrollFinish) ||
      currentPosition >= this._scrollFinish) {
      this.resetElement();
      if (currentPosition >= this._scrollFinish) {
        this.unstuckElement();
      }
      this.isStuck = false;    // stick when the element is within the sticky region
    } else if ( this.isStuck === false &&
      currentPosition > this._containerStart && currentPosition < this._scrollFinish) {
      this.stickElement();
    }
  }

  defineRestrictionsAndStick(): void {
    this.defineRestrictions();
    this.sticker();
  }


  private getCssValue(element: any, property: string): any {
    let result: any = '';
    if (typeof window.getComputedStyle !== 'undefined') {
      result = window.getComputedStyle(element, '').getPropertyValue(property);
    } else if (typeof element.currentStyle !== 'undefined')  {
      result = element.currentStyle.property;
    }
    return result;
  }

  private getCssNumber(element: any, property: string): number {
    return parseInt(this.getCssValue(element, property), 10) || 0;
  }
}
