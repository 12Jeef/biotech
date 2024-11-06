# Gierer-Meinhardt Model
#
#  da   C₁a²             d²a
#  -- = ---- - μa + D₁ ( --- )
#  dt    h               dx²
#
#  dh                    d²h
#  -- = C₂a² - νh + D₂ ( --- )
#  dt                    dx²
#

# scrub environment
graphics.off()
rm(list=ls())

FG = "#fff"
BG = "#191c2aff"
RED = "#ff144f"
BLUE = "#00bbff"

# FG = "#000"
# BG = "#fff"
# RED = "#cf0015"
# BLUE = "#0079cf"


# parameters
C1.d = 1
C2.d = 1

mu.d = 1
nu.d = 1.2

D1.d = 1
D2.d = 7.5

k.d = 10
N.d = 100

dt.d = 0.001
dx.d = 1


# GM calculate p value - fraction of cell that leaves cell for a specific direction
GM.calc.p = function(
  D=D1.d,
  dt=dt.d, dx=dx.d
) {
  return (D*dt / dx^2)
}

# GM rate for k
GM.calc.rk = function(
  D=D1.d,
  k=k.d,
  N=N.d,
  dt=dt.d, dx=dx.d
) {
  p = GM.calc.p(D=D, dt=dt, dx=dx)
  return (1 + 2*p*(cos(k*pi*dx/N) - 1))
}


# GM simulate - TODO not done yet
GM.sim = function(
  a0,
  C1=C1.d, C2=C2.d,
  mu=mu.d, nu=nu.d,
  D1=D1.d, D2=D2.d,
  dt=dt.d, dx=dx.d,
  t.max=100
) {
  N = dim(a0)
  for (t in 1:t.max) {
    # TODO add functionality to this
  }
}


# GM equilibrium finder
GM.eq = function(
  C1=C1.d, C2=C2.d,
  mu=mu.d, nu=nu.d
) {
  return (list(
    a0=(C1 * nu) / (C2 * mu),
    h0=(C1^2 * nu) / (C2 * mu^2)
  ))
}


# GM calculate Jacobian
GM.jacobian = function(
  C1=C1.d, C2=C2.d,
  mu=mu.d, nu=nu.d
) {
  return (matrix(c(
    mu,            -mu^2/C1,
    2*C1*nu / mu,  -nu
  ), nrow=2, ncol=2, byrow=T))
}

# GM calculate Jacobian for cosine
GM.jacobian.cosine = function(
  C1=C1.d, C2=C2.d,
  mu=mu.d, nu=nu.d,
  D1=D1.d, D2=D2.d,
  k=k.d,
  N=N.d,
  dt=dt.d, dx=dx.d
) {
  rka = GM.calc.rk(D=D1, k=k, N=N, dt=dt, dx=dx)
  rkh = GM.calc.rk(D=D2, k=k, N=N, dt=dt, dx=dx)
  J = GM.jacobian(C1=C1, C2=C2, mu=mu, nu=nu)
  J2 = matrix(c(
    rka-1,   0,
    0,   rkh-1
  ), nrow=2, ncol=2, byrow=T)
  return (matrix(c(1, 0, 0, 1), ncol=2, byrow=T) + (J*dt + J2))
}


# GM stability
GM.stable = function(
  C1=C1.d, C2=C2.d,
  mu=mu.d, nu=nu.d
) {
  J = GM.jacobian(C1=C1, C2=C2, mu=mu, nu=nu)
  return (tr(J) < 0)
}


# print(GM.jacobian())

ev = matrix(NA, nrow=N.d, ncol=2)
for (k in 0:(N.d-1)) {
  M = GM.jacobian.cosine(k=k)
  evk = eigen(M, EISPACK = TRUE)$values
  evk = Mod(evk)
  ev[k+1,] = evk
}
par(bg=BG)
xlim = c(10,30)
ylim = c(0.999,1.0005)
matplot(ev, type="l", xlab="", ylab="", col=c(BLUE, BLUE), xlim=xlim, ylim=ylim)
mtext("eigenvalues", side=2, line=2.5, col=FG, font=2)
mtext("k", side=1, line=2.5, col=FG, font=2)
axis(1, col=FG, col.axis=FG)
axis(2, col=FG, col.axis=FG)
box(col=FG)
abline(a=1, b=0, col=sprintf("%s%s", FG, "8"))
# rect(xlim[1], ylim[1], xlim[2], ylim[2], border=sprintf("%s%s", FG, "8"))

filter = which(ev[,1] > 1)
ev[filter,1]
freqs = filter-1

