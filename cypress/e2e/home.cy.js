describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should display the title', () => {
    cy.contains('Plantry')
    cy.contains('Meal planning made deliciously simple')
  })

  it('should have navigation links', () => {
    cy.get('nav').within(() => {
      cy.contains('a', 'Home')
      cy.contains('a', 'Recipes')
      cy.contains('a', 'Discover')
      cy.contains('a', 'Premium')
    })
  })

  it('should have a call to action button', () => {
    cy.contains('a', 'Start Planning')
  })
}) 