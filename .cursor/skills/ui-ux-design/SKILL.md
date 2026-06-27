---
name: ui-ux-design
description: >-
  UI and UX design principles for software development — visual hierarchy, color,
  typography, accessibility (WCAG 2.1 AA), responsive mobile-first layouts,
  interaction design, performance, user feedback, and design systems. Use when
  designing or implementing interfaces, components, layouts, forms, navigation,
  or reviewing UI/UX quality.
paths: src/**/*
---

# UI & UX Design Principles

Apply these standards when building or reviewing any interface in this project.

## Visual design

- Establish a clear visual hierarchy to guide user attention.
- Choose a cohesive color palette that reflects the brand (ask the user for guidelines if none exist).
- Use typography effectively for readability and emphasis.
- Maintain sufficient contrast for legibility (WCAG 2.1 AA standard).
- Design with a consistent style across the application.

## Interaction design

- Create intuitive navigation patterns.
- Use familiar UI components to reduce cognitive load.
- Provide clear calls-to-action to guide user behavior.
- Implement responsive design for cross-device compatibility.
- Use animations judiciously to enhance user experience.

## Accessibility

- Follow WCAG guidelines for web accessibility.
- Use semantic HTML to enhance screen reader compatibility.
- Provide alternative text for images and non-text content.
- Ensure keyboard navigability for all interactive elements.
- Test with various assistive technologies.

## Performance optimization

- Optimize images and assets to minimize load times.
- Implement lazy loading for non-critical resources.
- Use code splitting to improve initial load performance.
- Monitor and optimize Core Web Vitals (LCP, FID, CLS).

## User feedback

- Incorporate clear feedback mechanisms for user actions.
- Use loading indicators for asynchronous operations.
- Provide clear error messages and recovery options.
- Implement analytics to track user behavior and pain points.

## Information architecture

- Organize content logically to facilitate easy access.
- Use clear labeling and categorization for navigation.
- Implement effective search functionality.
- Create a sitemap to visualize overall structure.

## Mobile-first design

- Design for mobile devices first, then scale up.
- Use touch-friendly interface elements.
- Implement gestures for common actions (swipe, pinch-to-zoom).
- Consider thumb zones for important interactive elements.

## Consistency

- Develop and adhere to a design system.
- Use consistent terminology throughout the interface.
- Maintain consistent positioning of recurring elements.
- Ensure visual consistency across different sections.

## Testing and iteration

- Conduct A/B testing for critical design decisions.
- Use heatmaps and session recordings to analyze user behavior.
- Regularly gather and incorporate user feedback.
- Continuously iterate on designs based on data and feedback.

## Documentation

- Maintain a comprehensive style guide.
- Document design patterns and component usage.
- Create user flow diagrams for complex interactions.
- Keep design assets organized and accessible to the team.

## Fluid layouts

- Use relative units (%, em, rem) instead of fixed pixels.
- Implement CSS Grid and Flexbox for flexible layouts.
- Design with a mobile-first approach, then scale up.

## Media queries

- Use breakpoints to adjust layouts for different screen sizes.
- Focus on content needs rather than specific devices.
- Test designs across a range of devices and orientations.

## Images and media

- Use responsive images with `srcset` and `sizes` attributes.
- Implement lazy loading for images and videos.
- Use CSS to make embedded media (like iframes) responsive.

## Typography

- Use relative units (em, rem) for font sizes.
- Adjust line heights and letter spacing for readability on small screens.
- Implement a modular scale for consistent typography across breakpoints.

## Touch targets

- Ensure interactive elements are large enough for touch (min 44×44 pixels).
- Provide adequate spacing between touch targets.
- Consider hover states for desktop and focus states for touch/keyboard.

## Performance (mobile)

- Optimize assets for faster loading on mobile networks.
- Use CSS animations instead of JavaScript when possible.
- Implement critical CSS for above-the-fold content.

## Content prioritization

- Prioritize content display for mobile views.
- Use progressive disclosure to reveal content as needed.
- Implement off-canvas patterns for secondary content on small screens.

## Navigation

- Design mobile-friendly navigation patterns (e.g., hamburger menu).
- Ensure navigation is accessible via keyboard and screen readers.
- Consider using a sticky header for easy navigation access.

## Forms

- Design form layouts that adapt to different screen sizes.
- Use appropriate input types for better mobile experiences.
- Implement inline validation and clear error messaging.

## Testing

- Use browser developer tools to test responsiveness.
- Test on actual devices, not just emulators.
- Conduct usability testing across different device types.

## Next.js / Tailwind checklist

When implementing in this repo:

- [ ] Semantic HTML (`main`, `nav`, `section`, `button` vs `div`)
- [ ] `next/image` with `sizes` for responsive images
- [ ] Focus-visible styles on all interactive elements
- [ ] Loading and error states for async actions (Supabase, routing sim)
- [ ] Mobile-first Tailwind classes (`sm:`, `md:`, `lg:` scale up)
- [ ] Min 44px touch targets on primary controls
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text

Stay updated with the latest responsive design techniques, browser capabilities, and industry-standard UI/UX guidelines.
