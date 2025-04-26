import { render, screen } from '@testing-library/react'
import { Button } from '@/app/components/ui/Button'

describe('Button', () => {
  it('renders a button with the correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies the primary variant class by default', () => {
    render(<Button>Primary Button</Button>)
    const button = screen.getByRole('button', { name: 'Primary Button' })
    expect(button.className).toContain('bg-primary')
  })

  it('applies the correct variant class', () => {
    render(<Button variant="secondary">Secondary Button</Button>)
    const button = screen.getByRole('button', { name: 'Secondary Button' })
    expect(button.className).toContain('bg-neutral-200')
  })

  it('applies the correct size class', () => {
    render(<Button size="sm">Small Button</Button>)
    const button = screen.getByRole('button', { name: 'Small Button' })
    expect(button.className).toContain('h-8')
  })

  it('forwards onClick handlers', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click Handler</Button>)
    screen.getByRole('button', { name: 'Click Handler' }).click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
}) 