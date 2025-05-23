import {LitElement, css, html, nothing} from 'lit';
import {ref} from 'lit/directives/ref.js';
import './chromedash-form-table';
import './chromedash-form-field';
import {
  NEW_FEATURE_FORM_FIELDS,
  ENTERPRISE_NEW_FEATURE_FORM_FIELDS,
} from './form-definition';
import {ALL_FIELDS} from './form-field-specs';
import {SHARED_STYLES} from '../css/shared-css.js';
import {FORM_STYLES} from '../css/forms-css.js';
import {
  setupScrollToHash,
  formatFeatureChanges,
  getDisabledHelpText,
  FieldInfo,
} from './utils';
import {customElement, property, state} from 'lit/decorators.js';
import {Feature} from '../js-src/cs-client';

@customElement('chromedash-guide-new-page')
export class ChromedashGuideNewPage extends LitElement {
  static get styles() {
    return [
      ...SHARED_STYLES,
      ...FORM_STYLES,
      // The following style is a workaround to better support radio buttons
      // without sl-radio which does not yet do validation.
      // We do depend on sl-focus-ring being defined.
      css`
        table td label input[type='radio']:focus {
          box-shadow: 0 0 0 var(--sl-focus-ring-width)
            var(--sl-input-focus-ring-color);
        }
        .process-notice {
          margin: var(--content-padding-half) 0;
          padding: var(--content-padding-half);
          background: var(--light-accent-color);
          border-radius: 8px;
        }
        .process-notice p + p {
          margin-top: var(--content-padding-half);
        }
      `,
    ];
  }

  @property({attribute: false})
  userEmail = '';
  @property({type: Boolean})
  isEnterpriseFeature = false;
  @property({type: Number})
  featureId!: number;
  @property({type: Object})
  feature!: Feature;
  @state()
  fieldValues: FieldInfo[] & {feature?: Feature} = [];
  @property({type: Boolean})
  submitting = false;

  /* Add the form's event listener after Shoelace event listeners are attached
   * see more at https://github.com/GoogleChrome/chromium-dashboard/issues/2014 */
  async registerHandlers(el) {
    if (!el) return;

    await el.updateComplete;
    const hiddenTokenField = this.renderRoot.querySelector(
      'input[name=token]'
    ) as HTMLInputElement;
    hiddenTokenField.form?.addEventListener('submit', event => {
      this.handleFormSubmit(event, hiddenTokenField);
    });

    setupScrollToHash(this);
  }

  handleFormSubmit(event, hiddenTokenField) {
    event.preventDefault();
    formatFeatureChanges(this.fieldValues, this.featureId);

    // get the XSRF token and update it if it's expired before submission
    window.csClient.ensureTokenIsValid().then(() => {
      hiddenTokenField.value = window.csClient.token;
      this.submitting = true;
      event.target.submit();
    });
  }

  // Handler to update form values when a field update event is fired.
  handleFormFieldUpdate(event) {
    const value = event.detail.value;
    // Index represents which form was updated.
    const index = event.detail.index;
    if (index >= this.fieldValues.length) {
      throw new Error('Out of bounds index when updating field values.');
    }
    // The field has been updated, so it is considered touched.
    this.fieldValues[index].touched = true;
    this.fieldValues[index].value = value;
  }

  renderSubHeader() {
    return html`
      <div id="subheader" style="display:block">
        <span style="float:right; margin-right: 2em">
          <a
            href="https://github.com/GoogleChrome/chromium-dashboard/issues/new?labels=Feedback&amp;template=process-and-guide-ux-feedback.md"
            target="_blank"
            rel="noopener"
            >Process and UI feedback</a
          ></span
        >
        <h2 data-testid="add-a-feature">Add a feature</h2>
      </div>
    `;
  }

  renderWarnings() {
    if (this.isEnterpriseFeature) {
      return nothing;
    } else {
      return html`
        <div class="process-notice">
          <p>
            Please see the
            <a
              href="https://www.chromium.org/blink/launching-features"
              target="_blank"
              rel="noopener"
              >Launching features</a
            >
            page for process instructions.
          </p>

          <p>
            Googlers: Please follow the instructions at
            <a
              href="https://goto.corp.google.com/wp-launch-guidelines"
              target="_blank"
              rel="noopener"
              >go/wp-launch-guidelines</a
            >
            (internal document) to determine whether you also require an
            internal review.
          </p>
        </div>
      `;
    }
  }

  renderForm() {
    const newFeatureInitialValues = {
      owner: this.userEmail,
      shipping_year: new Date().getFullYear(),
    };
    this.fieldValues.feature = this.feature;

    const formFields = this.isEnterpriseFeature
      ? ENTERPRISE_NEW_FEATURE_FORM_FIELDS
      : NEW_FEATURE_FORM_FIELDS;
    const postAction = this.isEnterpriseFeature
      ? '/guide/enterprise/new'
      : '/guide/new';

    const renderFormField = (field, className?) => {
      const featureJSONKey = ALL_FIELDS[field].name || field;
      const value = newFeatureInitialValues[field];
      const index = this.fieldValues.length;
      this.fieldValues.push({
        name: featureJSONKey,
        touched: false,
        value, // stageId
      });

      return html`
        <chromedash-form-field
          name=${field}
          index=${index}
          value=${value}
          disabledReason="${getDisabledHelpText(field)}"
          .fieldValues=${this.fieldValues}
          ?forEnterprise=${this.isEnterpriseFeature}
          @form-field-update="${this.handleFormFieldUpdate}"
          class="${className || ''}"></chromedash-form-field>
          </chromedash-form-field>
          `;
    };

    const submitLabel = this.submitting
      ? 'Submitting...'
      : this.isEnterpriseFeature
        ? 'Continue'
        : 'Submit';
    return html`
      <section id="stage_form">
        <form name="overview_form" method="post" action=${postAction}>
          <input type="hidden" name="token" />
          <chromedash-form-table ${ref(this.registerHandlers)}>
            ${this.renderWarnings()}
            ${!this.isEnterpriseFeature
              ? renderFormField('feature_type_radio_group', 'choices')
              : nothing}
            ${formFields.map(field =>
              renderFormField(
                field,
                field === 'enterprise_product_category' ? 'choices' : null
              )
            )}
          </chromedash-form-table>
          <input
            type="submit"
            class="primary"
            ?disabled=${this.submitting}
            value=${submitLabel}
          />
        </form>
      </section>
    `;
  }

  render() {
    return html` ${this.renderSubHeader()} ${this.renderForm()} `;
  }
}
